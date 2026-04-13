import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";
import type { ExerciseHistoryView, ExerciseType } from "@/types/workout";

const HISTORY_LIMIT = 10;
const HISTORY_SESSION_SCAN_LIMIT = 100;

type DatabaseClient = SupabaseClient;

type ExerciseRow = {
  id: string;
  slug: string;
  name_ja: string;
  name_en: string;
};

type UserSessionRow = {
  id: string;
  started_at: string;
  program_day_id: string | null;
};

type WorkoutSessionExerciseRow = {
  id: string;
  workout_session_id: string;
  exercise_type: ExerciseType;
  order_index: number;
};

type WorkoutSetRow = {
  id: string;
  workout_session_exercise_id: string;
  set_number: number;
  weight_kg: number | string | null;
  reps_done: number | null;
  note: string | null;
};

type ProgramDayRow = {
  id: string;
  program_week_id: string;
  day_number: number;
};

type ProgramWeekRow = {
  id: string;
  program_id: string;
  week_number: number;
  label: string | null;
};

type ProgramRow = {
  id: string;
  title: string;
};

type ExerciseHistoryResult = {
  history: ExerciseHistoryView;
  errorMessage: string | null;
};

function humanizeExerciseSlug(exerciseSlug: string) {
  return exerciseSlug
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function buildFallbackHistory(
  exerciseSlug: string,
  overrides?: Partial<ExerciseHistoryView>
): ExerciseHistoryView {
  return {
    exerciseSlug,
    exerciseNameJa: overrides?.exerciseNameJa ?? "種目履歴",
    exerciseNameEn: overrides?.exerciseNameEn ?? humanizeExerciseSlug(exerciseSlug),
    exerciseType: overrides?.exerciseType ?? "T3",
    sessions: overrides?.sessions ?? []
  };
}

function toNullableNumber(value: number | string | null) {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatSessionDate(startedAt: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(startedAt)) {
    return startedAt.slice(0, 10);
  }

  const parsed = new Date(startedAt);
  if (Number.isNaN(parsed.getTime())) {
    return startedAt;
  }

  return parsed.toISOString().slice(0, 10);
}

function buildProgramLabel(
  programTitle: string | null,
  weekNumber: number | null,
  weekLabel: string | null,
  dayNumber: number | null
) {
  const normalizedTitle = programTitle?.trim() || null;
  const normalizedWeekLabel = weekLabel?.trim() || null;
  const detailLabel =
    normalizedWeekLabel ||
    [
      weekNumber ? `Week ${weekNumber}` : null,
      dayNumber ? `Day ${dayNumber}` : null
    ]
      .filter(Boolean)
      .join(" ");

  if (normalizedTitle && detailLabel) {
    return `${normalizedTitle} ${detailLabel}`;
  }

  if (normalizedTitle) {
    return normalizedTitle;
  }

  if (detailLabel) {
    return detailLabel;
  }

  return "Current Workout";
}

async function selectExerciseBySlug(
  client: DatabaseClient,
  exerciseSlug: string
) {
  const { data, error } = await client
    .from("exercises")
    .select("id, slug, name_ja, name_en")
    .eq("slug", exerciseSlug)
    .maybeSingle<ExerciseRow>();

  if (error) {
    throw new Error(`Failed to load exercise: ${error.message}`);
  }

  return data;
}

async function selectRecentUserSessions(client: DatabaseClient, userId: string) {
  const { data, error } = await client
    .from("workout_sessions")
    .select("id, started_at, program_day_id")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(HISTORY_SESSION_SCAN_LIMIT);

  if (error) {
    throw new Error(`Failed to load user workout sessions: ${error.message}`);
  }

  return (data ?? []) as UserSessionRow[];
}

async function selectWorkoutSessionExercises(
  client: DatabaseClient,
  workoutSessionIds: string[],
  exerciseId: string
) {
  if (workoutSessionIds.length === 0) {
    return [] as WorkoutSessionExerciseRow[];
  }

  const { data, error } = await client
    .from("workout_session_exercises")
    .select("id, workout_session_id, exercise_type, order_index")
    .eq("exercise_id", exerciseId)
    .in("workout_session_id", workoutSessionIds);

  if (error) {
    throw new Error(
      `Failed to load workout session exercises: ${error.message}`
    );
  }

  return (data ?? []) as WorkoutSessionExerciseRow[];
}

async function selectCompletedWorkoutSets(
  client: DatabaseClient,
  workoutSessionExerciseIds: string[]
) {
  if (workoutSessionExerciseIds.length === 0) {
    return [] as WorkoutSetRow[];
  }

  const { data, error } = await client
    .from("workout_sets")
    .select(
      "id, workout_session_exercise_id, set_number, weight_kg, reps_done, note"
    )
    .in("workout_session_exercise_id", workoutSessionExerciseIds)
    .eq("is_completed", true)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Failed to load completed workout sets: ${error.message}`);
  }

  return (data ?? []) as WorkoutSetRow[];
}

async function selectProgramDays(
  client: DatabaseClient,
  programDayIds: string[]
) {
  if (programDayIds.length === 0) {
    return [] as ProgramDayRow[];
  }

  const { data, error } = await client
    .from("program_days")
    .select("id, program_week_id, day_number")
    .in("id", programDayIds);

  if (error) {
    throw new Error(`Failed to load program days: ${error.message}`);
  }

  return (data ?? []) as ProgramDayRow[];
}

async function selectProgramWeeks(
  client: DatabaseClient,
  programWeekIds: string[]
) {
  if (programWeekIds.length === 0) {
    return [] as ProgramWeekRow[];
  }

  const { data, error } = await client
    .from("program_weeks")
    .select("id, program_id, week_number, label")
    .in("id", programWeekIds);

  if (error) {
    throw new Error(`Failed to load program weeks: ${error.message}`);
  }

  return (data ?? []) as ProgramWeekRow[];
}

async function selectPrograms(client: DatabaseClient, programIds: string[]) {
  if (programIds.length === 0) {
    return [] as ProgramRow[];
  }

  const { data, error } = await client
    .from("programs")
    .select("id, title")
    .in("id", programIds);

  if (error) {
    throw new Error(`Failed to load programs: ${error.message}`);
  }

  return (data ?? []) as ProgramRow[];
}

export async function getExerciseHistoryView(
  exerciseSlug: string
): Promise<ExerciseHistoryResult> {
  const fallbackHistory = buildFallbackHistory(exerciseSlug);

  if (!hasSupabasePublicEnv()) {
    return {
      history: fallbackHistory,
      errorMessage: "Supabase is not configured for this environment."
    };
  }

  try {
    const serverClient = createSupabaseServerClient();
    const scopedUser = await serverClient.auth.getUser();
    const userId = scopedUser.data.user?.id ?? null;

    if (!userId) {
      return {
        history: fallbackHistory,
        errorMessage: "Sign in is required to load exercise history."
      };
    }

    const queryClient = serverClient;

    const exercise = await selectExerciseBySlug(queryClient, exerciseSlug);

    if (!exercise) {
      return {
        history: fallbackHistory,
        errorMessage: "The requested exercise could not be found."
      };
    }

    const recentSessions = await selectRecentUserSessions(queryClient, userId);
    const recentSessionIds = recentSessions.map((session) => session.id);
    const workoutSessionExercises = await selectWorkoutSessionExercises(
      queryClient,
      recentSessionIds,
      exercise.id
    );

    const latestExerciseType =
      recentSessions
        .map((session) =>
          workoutSessionExercises.find(
            (item) => item.workout_session_id === session.id
          )?.exercise_type
        )
        .find(Boolean) ?? "T3";

    const historyBase = buildFallbackHistory(exerciseSlug, {
      exerciseNameJa: exercise.name_ja,
      exerciseNameEn: exercise.name_en,
      exerciseType: latestExerciseType
    });

    if (workoutSessionExercises.length === 0) {
      return {
        history: historyBase,
        errorMessage: null
      };
    }

    const sessionExerciseMap = new Map(
      workoutSessionExercises.map((item) => [item.id, item])
    );
    const completedSets = await selectCompletedWorkoutSets(
      queryClient,
      workoutSessionExercises.map((item) => item.id)
    );

    if (completedSets.length === 0) {
      return {
        history: historyBase,
        errorMessage: null
      };
    }

    const setsBySession = new Map<
      string,
      Array<{
        orderIndex: number;
        setNumber: number;
        weightKg: number | null;
        repsDone: number | null;
        note: string;
      }>
    >();

    completedSets.forEach((set) => {
      const sessionExercise = sessionExerciseMap.get(set.workout_session_exercise_id);

      if (!sessionExercise) {
        return;
      }

      const group = setsBySession.get(sessionExercise.workout_session_id) ?? [];
      group.push({
        orderIndex: sessionExercise.order_index,
        setNumber: set.set_number,
        weightKg: toNullableNumber(set.weight_kg),
        repsDone: set.reps_done,
        note: set.note ?? ""
      });
      setsBySession.set(sessionExercise.workout_session_id, group);
    });

    const visibleSessions = recentSessions
      .filter((session) => setsBySession.has(session.id))
      .slice(0, HISTORY_LIMIT);

    const programDayIds = Array.from(
      new Set(
        visibleSessions
          .map((session) => session.program_day_id)
          .filter((programDayId): programDayId is string => Boolean(programDayId))
      )
    );
    const programDays = await selectProgramDays(queryClient, programDayIds);
    const programDayMap = new Map(programDays.map((item) => [item.id, item]));

    const programWeekIds = Array.from(
      new Set(programDays.map((programDay) => programDay.program_week_id))
    );
    const programWeeks = await selectProgramWeeks(queryClient, programWeekIds);
    const programWeekMap = new Map(programWeeks.map((item) => [item.id, item]));

    const programIds = Array.from(
      new Set(programWeeks.map((programWeek) => programWeek.program_id))
    );
    const programs = await selectPrograms(queryClient, programIds);
    const programMap = new Map(programs.map((item) => [item.id, item]));

    return {
      history: {
        ...historyBase,
        sessions: visibleSessions.map((session) => {
          const sessionSets = (setsBySession.get(session.id) ?? [])
            .sort((left, right) => {
              if (left.orderIndex !== right.orderIndex) {
                return left.orderIndex - right.orderIndex;
              }

              return left.setNumber - right.setNumber;
            })
            .map((set) => ({
              setNumber: set.setNumber,
              weightKg: set.weightKg,
              repsDone: set.repsDone,
              note: set.note
            }));

          const programDay = session.program_day_id
            ? programDayMap.get(session.program_day_id) ?? null
            : null;
          const programWeek = programDay
            ? programWeekMap.get(programDay.program_week_id) ?? null
            : null;
          const program = programWeek
            ? programMap.get(programWeek.program_id) ?? null
            : null;

          return {
            sessionId: session.id,
            sessionDate: formatSessionDate(session.started_at),
            programLabel: buildProgramLabel(
              program?.title ?? null,
              programWeek?.week_number ?? null,
              programWeek?.label ?? null,
              programDay?.day_number ?? null
            ),
            sets: sessionSets
          };
        })
      },
      errorMessage: null
    };
  } catch (error) {
    console.error("Failed to load exercise history from Supabase.", error);

    return {
      history: fallbackHistory,
      errorMessage:
        "Exercise history could not be loaded right now. Please try again."
    };
  }
}

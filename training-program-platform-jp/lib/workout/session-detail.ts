import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";
import type {
  ExerciseType,
  SessionDetailResult,
  WorkoutSessionStatus,
  WorkoutSessionDetailExercise,
  WorkoutSessionDetailSet
} from "@/types/workout";

type DatabaseClient = SupabaseClient;

type SessionRow = {
  id: string;
  user_id: string;
  program_day_id: string | null;
  started_at: string;
  finished_at: string | null;
  status: WorkoutSessionStatus;
};

type SessionExerciseRow = {
  id: string;
  exercise_id: string;
  exercise_type: ExerciseType;
  order_index: number;
  was_added: boolean;
  was_swapped: boolean;
};

type ExerciseRow = {
  id: string;
  slug: string;
  name_ja: string;
  name_en: string;
};

type WorkoutSetRow = {
  id: string;
  workout_session_exercise_id: string;
  set_number: number;
  weight_kg: number | string | null;
  reps_done: number | null;
  is_completed: boolean;
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

function toNullableNumber(value: number | string | null): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function selectSession(
  client: DatabaseClient,
  sessionId: string,
  userId: string
): Promise<SessionRow | null> {
  const { data, error } = await client
    .from("workout_sessions")
    .select("id, user_id, program_day_id, started_at, finished_at, status")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle<SessionRow>();

  if (error) {
    throw new Error(`Failed to load session: ${error.message}`);
  }

  return data;
}

async function selectSessionExercises(
  client: DatabaseClient,
  sessionId: string
): Promise<SessionExerciseRow[]> {
  const { data, error } = await client
    .from("workout_session_exercises")
    .select("id, exercise_id, exercise_type, order_index, was_added, was_swapped")
    .eq("workout_session_id", sessionId)
    .order("order_index", { ascending: true });

  if (error) {
    throw new Error(`Failed to load session exercises: ${error.message}`);
  }

  return (data ?? []) as SessionExerciseRow[];
}

async function selectExercises(
  client: DatabaseClient,
  exerciseIds: string[]
): Promise<ExerciseRow[]> {
  if (exerciseIds.length === 0) return [];

  const { data, error } = await client
    .from("exercises")
    .select("id, slug, name_ja, name_en")
    .in("id", exerciseIds);

  if (error) {
    throw new Error(`Failed to load exercises: ${error.message}`);
  }

  return (data ?? []) as ExerciseRow[];
}

async function selectVisibleSets(
  client: DatabaseClient,
  sessionExerciseIds: string[]
): Promise<WorkoutSetRow[]> {
  if (sessionExerciseIds.length === 0) return [];

  const { data, error } = await client
    .from("workout_sets")
    .select(
      "id, workout_session_exercise_id, set_number, weight_kg, reps_done, is_completed, note"
    )
    .in("workout_session_exercise_id", sessionExerciseIds)
    .is("deleted_at", null)
    .order("set_number", { ascending: true });

  if (error) {
    throw new Error(`Failed to load workout sets: ${error.message}`);
  }

  return (data ?? []) as WorkoutSetRow[];
}

async function selectProgramDay(
  client: DatabaseClient,
  programDayId: string | null
): Promise<ProgramDayRow | null> {
  if (!programDayId) return null;

  const { data, error } = await client
    .from("program_days")
    .select("id, program_week_id, day_number")
    .eq("id", programDayId)
    .maybeSingle<ProgramDayRow>();

  if (error) return null;

  return data;
}

async function selectProgramWeek(
  client: DatabaseClient,
  programWeekId: string | null
): Promise<ProgramWeekRow | null> {
  if (!programWeekId) return null;

  const { data, error } = await client
    .from("program_weeks")
    .select("id, program_id, week_number, label")
    .eq("id", programWeekId)
    .maybeSingle<ProgramWeekRow>();

  if (error) return null;

  return data;
}

async function selectProgram(
  client: DatabaseClient,
  programId: string | null
): Promise<ProgramRow | null> {
  if (!programId) return null;

  const { data, error } = await client
    .from("programs")
    .select("id, title")
    .eq("id", programId)
    .maybeSingle<ProgramRow>();

  if (error) return null;

  return data;
}

function buildProgramWeekDayLabel(
  programTitle: string | null,
  weekNumber: number | null,
  weekLabel: string | null,
  dayNumber: number | null
): string | null {
  const normalizedWeekLabel = weekLabel?.trim() || null;
  const weekPart = normalizedWeekLabel ?? (weekNumber ? `Week ${weekNumber}` : null);
  const dayPart = dayNumber ? `Day ${dayNumber}` : null;
  const detailLabel = [weekPart, dayPart].filter(Boolean).join(" / ");

  if (programTitle && detailLabel) {
    return `${programTitle} — ${detailLabel}`;
  }

  if (detailLabel) return detailLabel;
  if (programTitle) return programTitle;

  return null;
}

export async function getWorkoutSessionDetailView(
  sessionId: string
): Promise<SessionDetailResult> {
  if (!hasSupabasePublicEnv()) {
    return {
      detail: null,
      errorMessage: "Supabase is not configured for this environment."
    };
  }

  try {
    const serverClient = createSupabaseServerClient();
    const scopedUser = await serverClient.auth.getUser();
    const userId = scopedUser.data.user?.id ?? null;

    if (!userId) {
      return {
        detail: null,
        errorMessage: "Sign in is required to view session details."
      };
    }

    const session = await selectSession(serverClient, sessionId, userId);

    if (!session) {
      return {
        detail: null,
        errorMessage: "Session not found or does not belong to the signed-in user."
      };
    }

    const sessionExercises = await selectSessionExercises(serverClient, session.id);

    const exerciseIds = sessionExercises.map((item) => item.exercise_id);
    const exercises = await selectExercises(serverClient, exerciseIds);
    const exerciseMap = new Map(exercises.map((item) => [item.id, item]));

    const sessionExerciseIds = sessionExercises.map((item) => item.id);
    const allSets = await selectVisibleSets(serverClient, sessionExerciseIds);

    // Group sets by session_exercise_id
    const setsByExercise = new Map<string, WorkoutSetRow[]>();
    allSets.forEach((set) => {
      const group = setsByExercise.get(set.workout_session_exercise_id) ?? [];
      group.push(set);
      setsByExercise.set(set.workout_session_exercise_id, group);
    });

    const programDay = await selectProgramDay(serverClient, session.program_day_id);
    const programWeek = await selectProgramWeek(
      serverClient,
      programDay?.program_week_id ?? null
    );
    const program = await selectProgram(
      serverClient,
      programWeek?.program_id ?? null
    );

    const detailExercises: WorkoutSessionDetailExercise[] = sessionExercises.map(
      (sessionExercise) => {
        const exercise = exerciseMap.get(sessionExercise.exercise_id);
        const rawSets = setsByExercise.get(sessionExercise.id) ?? [];

        const detailSets: WorkoutSessionDetailSet[] = rawSets.map((set) => ({
          id: set.id,
          setNumber: set.set_number,
          weightKg: toNullableNumber(set.weight_kg),
          repsDone: set.reps_done,
          isCompleted: set.is_completed,
          note: set.note ?? ""
        }));

        return {
          id: sessionExercise.id,
          exerciseId: sessionExercise.exercise_id,
          exerciseSlug: exercise?.slug ?? sessionExercise.exercise_id,
          exerciseNameJa: exercise?.name_ja ?? "種目",
          exerciseNameEn: exercise?.name_en ?? "種目",
          exerciseType: sessionExercise.exercise_type,
          orderIndex: sessionExercise.order_index,
          wasAdded: sessionExercise.was_added,
          wasSwapped: sessionExercise.was_swapped,
          sets: detailSets
        };
      }
    );

    return {
      detail: {
        sessionId: session.id,
        status: session.status,
        startedAt: session.started_at,
        finishedAt: session.finished_at,
        programTitle: program?.title ?? null,
        programWeekDayLabel: buildProgramWeekDayLabel(
          program?.title ?? null,
          programWeek?.week_number ?? null,
          programWeek?.label ?? null,
          programDay?.day_number ?? null
        ),
        exercises: detailExercises
      },
      errorMessage: null
    };
  } catch (error) {
    console.error("Failed to load session detail from Supabase.", error);

    return {
      detail: null,
      errorMessage: "Session details could not be loaded. Please try again."
    };
  }
}

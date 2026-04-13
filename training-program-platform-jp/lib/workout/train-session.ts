import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getMockWorkoutSession } from "@/lib/mock/workout";
import { hasSupabasePublicEnv } from "@/lib/supabase/server";
import {
  createWorkoutQueryClient,
  getAuthenticatedWorkoutUserId
} from "@/lib/workout/session-access";
import type {
  ExerciseType,
  WorkoutExerciseBlock,
  WorkoutSessionStatus,
  WorkoutSessionView
} from "@/types/workout";

type DatabaseClient = SupabaseClient;

type WorkoutSessionRow = {
  id: string;
  user_id: string;
  program_enrollment_id: string | null;
  program_day_id: string | null;
  started_at: string;
  finished_at: string | null;
  status: WorkoutSessionStatus;
};

type ProgramDayRow = {
  id: string;
  program_week_id: string;
  day_number: number;
  progression_guide: string | null;
  notes: string | null;
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

type WorkoutSessionExerciseRow = {
  id: string;
  workout_session_id: string;
  exercise_id: string;
  exercise_type: ExerciseType;
  order_index: number;
  was_swapped: boolean;
  was_added: boolean;
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
  target_reps_text: string | null;
  weight_kg: number | string | null;
  reps_done: number | null;
  is_completed: boolean;
  is_locked: boolean;
  completed_at: string | null;
  is_auto_filled: boolean;
  note: string | null;
  deleted_at: string | null;
};

type HistoricalSessionRow = {
  id: string;
  started_at: string;
};

type PreviousCandidate = {
  startedAt: string;
  weightKg: number | null;
  repsDone: number | null;
};

function toNullableNumber(value: number | string | null): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildProgramWeekLabel(
  weekNumber: number | null,
  weekLabel: string | null,
  dayNumber: number | null
) {
  const weekPart =
    weekLabel?.trim() ||
    (weekNumber ? `Week ${weekNumber}` : "Current Workout");

  return dayNumber ? `${weekPart} / Day ${dayNumber}` : weekPart;
}

function formatPreviousDisplay(
  weightKg: number | null,
  repsDone: number | null
) {
  if (weightKg === null && repsDone === null) {
    return "-";
  }

  if (weightKg !== null && repsDone !== null) {
    return `${weightKg}kg x ${repsDone}`;
  }

  if (weightKg !== null) {
    return `${weightKg}kg`;
  }

  return `x ${repsDone}`;
}

async function selectCurrentSession(
  client: DatabaseClient,
  userId: string
) {
  const { data: inProgressSession, error: inProgressError } = await client
    .from("workout_sessions")
    .select(
      "id, user_id, program_enrollment_id, program_day_id, started_at, finished_at, status"
    )
    .eq("status", "in_progress")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<WorkoutSessionRow>();

  if (inProgressError) {
    throw new Error(
      `Failed to load current workout session: ${inProgressError.message}`
    );
  }

  if (inProgressSession) {
    return inProgressSession;
  }

  const { data: latestSession, error: latestError } = await client
    .from("workout_sessions")
    .select(
      "id, user_id, program_enrollment_id, program_day_id, started_at, finished_at, status"
    )
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<WorkoutSessionRow>();

  if (latestError) {
    throw new Error(`Failed to load latest workout session: ${latestError.message}`);
  }

  return latestSession;
}

async function selectSessionByDayId(
  client: DatabaseClient,
  programDayId: string,
  userId: string
) {
  const { data, error } = await client
    .from("workout_sessions")
    .select(
      "id, user_id, program_enrollment_id, program_day_id, started_at, finished_at, status"
    )
    .eq("status", "in_progress")
    .eq("program_day_id", programDayId)
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<WorkoutSessionRow>();

  if (error) {
    throw new Error(`Failed to find session by day id: ${error.message}`);
  }

  return data;
}

async function selectProgramDay(
  client: DatabaseClient,
  programDayId: string | null
) {
  if (!programDayId) return null;

  const { data, error } = await client
    .from("program_days")
    .select("id, program_week_id, day_number, progression_guide, notes")
    .eq("id", programDayId)
    .maybeSingle<ProgramDayRow>();

  if (error) {
    throw new Error(`Failed to load program day: ${error.message}`);
  }

  return data;
}

async function selectProgramWeek(
  client: DatabaseClient,
  programWeekId: string | null
) {
  if (!programWeekId) return null;

  const { data, error } = await client
    .from("program_weeks")
    .select("id, program_id, week_number, label")
    .eq("id", programWeekId)
    .maybeSingle<ProgramWeekRow>();

  if (error) {
    throw new Error(`Failed to load program week: ${error.message}`);
  }

  return data;
}

async function selectProgram(client: DatabaseClient, programId: string | null) {
  if (!programId) return null;

  const { data, error } = await client
    .from("programs")
    .select("id, title")
    .eq("id", programId)
    .maybeSingle<ProgramRow>();

  if (error) {
    throw new Error(`Failed to load program: ${error.message}`);
  }

  return data;
}

async function selectWorkoutSessionExercises(
  client: DatabaseClient,
  workoutSessionId: string
) {
  const { data, error } = await client
    .from("workout_session_exercises")
    .select(
      "id, workout_session_id, exercise_id, exercise_type, order_index, was_swapped, was_added"
    )
    .eq("workout_session_id", workoutSessionId)
    .order("order_index", { ascending: true });

  if (error) {
    throw new Error(`Failed to load workout exercises: ${error.message}`);
  }

  return (data ?? []) as WorkoutSessionExerciseRow[];
}

async function selectExercises(client: DatabaseClient, exerciseIds: string[]) {
  if (exerciseIds.length === 0) {
    return [] as ExerciseRow[];
  }

  const { data, error } = await client
    .from("exercises")
    .select("id, slug, name_ja, name_en")
    .in("id", exerciseIds);

  if (error) {
    throw new Error(`Failed to load exercises: ${error.message}`);
  }

  return (data ?? []) as ExerciseRow[];
}

async function selectVisibleWorkoutSets(
  client: DatabaseClient,
  workoutSessionExerciseIds: string[]
) {
  if (workoutSessionExerciseIds.length === 0) {
    return [] as WorkoutSetRow[];
  }

  const { data, error } = await client
    .from("workout_sets")
    .select(
      "id, workout_session_exercise_id, set_number, target_reps_text, weight_kg, reps_done, is_completed, is_locked, completed_at, is_auto_filled, note, deleted_at"
    )
    .in("workout_session_exercise_id", workoutSessionExerciseIds)
    .is("deleted_at", null)
    .order("workout_session_exercise_id", { ascending: true })
    .order("set_number", { ascending: true });

  if (error) {
    throw new Error(`Failed to load workout sets: ${error.message}`);
  }

  return (data ?? []) as WorkoutSetRow[];
}

async function selectHistoricalSessions(
  client: DatabaseClient,
  userId: string,
  currentWorkoutSessionId: string
) {
  const { data, error } = await client
    .from("workout_sessions")
    .select("id, started_at")
    .eq("user_id", userId)
    .neq("id", currentWorkoutSessionId)
    .order("started_at", { ascending: false });

  if (error) {
    throw new Error(
      `Failed to load historical workout sessions: ${error.message}`
    );
  }

  return (data ?? []) as HistoricalSessionRow[];
}

async function selectHistoricalWorkoutSessionExercises(
  client: DatabaseClient,
  workoutSessionIds: string[],
  exerciseIds: string[]
) {
  if (workoutSessionIds.length === 0 || exerciseIds.length === 0) {
    return [] as WorkoutSessionExerciseRow[];
  }

  const { data, error } = await client
    .from("workout_session_exercises")
    .select(
      "id, workout_session_id, exercise_id, exercise_type, order_index, was_swapped, was_added"
    )
    .in("workout_session_id", workoutSessionIds)
    .in("exercise_id", exerciseIds);

  if (error) {
    throw new Error(
      `Failed to load historical workout session exercises: ${error.message}`
    );
  }

  return (data ?? []) as WorkoutSessionExerciseRow[];
}

async function selectHistoricalCompletedWorkoutSets(
  client: DatabaseClient,
  workoutSessionExerciseIds: string[],
  setNumbers: number[]
) {
  if (workoutSessionExerciseIds.length === 0 || setNumbers.length === 0) {
    return [] as WorkoutSetRow[];
  }

  const { data, error } = await client
    .from("workout_sets")
    .select(
      "id, workout_session_exercise_id, set_number, target_reps_text, weight_kg, reps_done, is_completed, is_locked, completed_at, is_auto_filled, note, deleted_at"
    )
    .in("workout_session_exercise_id", workoutSessionExerciseIds)
    .in("set_number", setNumbers)
    .eq("is_completed", true)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Failed to load historical completed sets: ${error.message}`);
  }

  return (data ?? []) as WorkoutSetRow[];
}

async function buildPreviousDisplayMap(
  client: DatabaseClient,
  currentSession: WorkoutSessionRow,
  workoutSessionExercises: WorkoutSessionExerciseRow[],
  workoutSets: WorkoutSetRow[]
) {
  const uniqueExerciseIds = Array.from(
    new Set(workoutSessionExercises.map((item) => item.exercise_id))
  );
  const uniqueSetNumbers = Array.from(new Set(workoutSets.map((item) => item.set_number)));

  if (uniqueExerciseIds.length === 0 || uniqueSetNumbers.length === 0) {
    return new Map<string, string>();
  }

  if (!currentSession.user_id) {
    return new Map<string, string>();
  }

  const historicalSessions = await selectHistoricalSessions(
    client,
    currentSession.user_id,
    currentSession.id
  );
  const historicalSessionIds = historicalSessions.map((item) => item.id);

  if (historicalSessionIds.length === 0) {
    return new Map<string, string>();
  }

  const sessionStartedAtMap = new Map(
    historicalSessions.map((item) => [item.id, item.started_at])
  );

  const historicalSessionExercises = await selectHistoricalWorkoutSessionExercises(
    client,
    historicalSessionIds,
    uniqueExerciseIds
  );
  const historicalWorkoutSessionExerciseIds = historicalSessionExercises.map(
    (item) => item.id
  );

  if (historicalWorkoutSessionExerciseIds.length === 0) {
    return new Map<string, string>();
  }

  const historicalExerciseMap = new Map(
    historicalSessionExercises.map((item) => [
      item.id,
      {
        exerciseId: item.exercise_id,
        startedAt: sessionStartedAtMap.get(item.workout_session_id) ?? ""
      }
    ])
  );

  const historicalCompletedSets = await selectHistoricalCompletedWorkoutSets(
    client,
    historicalWorkoutSessionExerciseIds,
    uniqueSetNumbers
  );

  const previousCandidateMap = new Map<string, PreviousCandidate>();

  historicalCompletedSets.forEach((set) => {
    const historicalExercise = historicalExerciseMap.get(
      set.workout_session_exercise_id
    );

    if (!historicalExercise || !historicalExercise.startedAt) {
      return;
    }

    const key = `${historicalExercise.exerciseId}:${set.set_number}`;
    const nextCandidate: PreviousCandidate = {
      startedAt: historicalExercise.startedAt,
      weightKg: toNullableNumber(set.weight_kg),
      repsDone: set.reps_done
    };
    const currentCandidate = previousCandidateMap.get(key);

    if (!currentCandidate || nextCandidate.startedAt > currentCandidate.startedAt) {
      previousCandidateMap.set(key, nextCandidate);
    }
  });

  return new Map(
    Array.from(previousCandidateMap.entries()).map(([key, value]) => [
      key,
      formatPreviousDisplay(value.weightKg, value.repsDone)
    ])
  );
}

function buildExerciseBlocks(
  workoutSessionExercises: WorkoutSessionExerciseRow[],
  exercises: ExerciseRow[],
  workoutSets: WorkoutSetRow[],
  previousDisplayMap: Map<string, string>
) {
  const exerciseMap = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const setsByExercise = new Map<string, WorkoutSetRow[]>();

  workoutSets.forEach((set) => {
    const group = setsByExercise.get(set.workout_session_exercise_id) ?? [];
    group.push(set);
    setsByExercise.set(set.workout_session_exercise_id, group);
  });

  return workoutSessionExercises.map<WorkoutExerciseBlock>((sessionExercise) => {
    const exercise = exerciseMap.get(sessionExercise.exercise_id);
    const visibleSets = (setsByExercise.get(sessionExercise.id) ?? []).map(
      (set, index) => {
        const previousKey = `${sessionExercise.exercise_id}:${set.set_number}`;

        return {
          id: set.id,
          setNumber: set.set_number,
          displaySetNumber: index + 1,
          targetRepsText: set.target_reps_text,
          weightKg: toNullableNumber(set.weight_kg),
          repsDone: set.reps_done,
          isCompleted: set.is_completed,
          isLocked: set.is_locked,
          completedAt: set.completed_at,
          isAutoFilled: set.is_auto_filled,
          note: set.note ?? "",
          previousDisplay: previousDisplayMap.get(previousKey) ?? "-",
          deletedAt: set.deleted_at
        };
      }
    );

    return {
      id: sessionExercise.id,
      exerciseId: sessionExercise.exercise_id,
      exerciseSlug: exercise?.slug ?? sessionExercise.exercise_id,
      exerciseNameJa: exercise?.name_ja ?? "Exercise",
      exerciseNameEn: exercise?.name_en ?? "Exercise",
      exerciseType: sessionExercise.exercise_type,
      orderIndex: sessionExercise.order_index,
      previousSets: [],
      sets: visibleSets,
      wasAdded: sessionExercise.was_added,
      wasSwapped: sessionExercise.was_swapped
    };
  });
}

function countIncompleteVisibleSets(workoutSets: WorkoutSetRow[]) {
  return workoutSets.filter((set) => set.is_completed === false).length;
}

/**
 * Shared: loads the full WorkoutSessionView for a given session row.
 * Called by both getCurrentWorkoutSessionView and findWorkoutSessionByDayId.
 */
async function loadSessionView(
  queryClient: DatabaseClient,
  session: WorkoutSessionRow
): Promise<WorkoutSessionView> {
  const programDay = await selectProgramDay(queryClient, session.program_day_id);
  const programWeek = await selectProgramWeek(
    queryClient,
    programDay?.program_week_id ?? null
  );
  const program = await selectProgram(queryClient, programWeek?.program_id ?? null);

  const workoutSessionExercises = await selectWorkoutSessionExercises(
    queryClient,
    session.id
  );
  const exercises = await selectExercises(
    queryClient,
    workoutSessionExercises.map((item) => item.exercise_id)
  );
  const workoutSets = await selectVisibleWorkoutSets(
    queryClient,
    workoutSessionExercises.map((item) => item.id)
  );
  const previousDisplayMap = await buildPreviousDisplayMap(
    queryClient,
    session,
    workoutSessionExercises,
    workoutSets
  );

  return {
    id: session.id,
    userId: session.user_id,
    programEnrollmentId: session.program_enrollment_id,
    programDayId: session.program_day_id,
    programTitle: program?.title ?? "Current Program",
    programWeekLabel: buildProgramWeekLabel(
      programWeek?.week_number ?? null,
      programWeek?.label ?? null,
      programDay?.day_number ?? null
    ),
    progressionGuide:
      programDay?.progression_guide ?? "Progression guide is not set yet.",
    notes:
      programDay?.notes ?? "Train screen is reading active sets from Supabase.",
    startedAt: session.started_at,
    finishedAt: session.finished_at,
    status: session.status,
    incompleteSetCount: countIncompleteVisibleSets(workoutSets),
    exercises: buildExerciseBlocks(
      workoutSessionExercises,
      exercises,
      workoutSets,
      previousDisplayMap
    )
  };
}

export async function getCurrentWorkoutSessionView(): Promise<WorkoutSessionView> {
  if (!hasSupabasePublicEnv()) {
    return getMockWorkoutSession();
  }

  try {
    const userId = await getAuthenticatedWorkoutUserId();

    if (!userId) {
      return getMockWorkoutSession();
    }

    const queryClient = createWorkoutQueryClient();

    const session = await selectCurrentSession(queryClient, userId);

    if (!session) {
      return getMockWorkoutSession();
    }

    return await loadSessionView(queryClient, session);
  } catch (error) {
    console.error("Failed to load train session from Supabase.", error);
    return getMockWorkoutSession();
  }
}

/**
 * Finds an in_progress workout session for the given program_day_id.
 * Returns null when none exists — callers show a "Start Workout" screen instead.
 */
export async function findWorkoutSessionByDayId(
  programDayId: string
): Promise<WorkoutSessionView | null> {
  if (!hasSupabasePublicEnv()) return null;

  try {
    const userId = await getAuthenticatedWorkoutUserId();

    if (!userId) return null;

    const queryClient = createWorkoutQueryClient();

    const session = await selectSessionByDayId(queryClient, programDayId, userId);

    if (!session) return null;

    return await loadSessionView(queryClient, session);
  } catch (error) {
    console.error("Failed to find workout session by day id.", error);
    return null;
  }
}

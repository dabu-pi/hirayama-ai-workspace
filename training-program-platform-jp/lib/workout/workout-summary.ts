import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasSupabasePublicEnv,
  hasSupabaseServiceRoleEnv
} from "@/lib/supabase/server";
import type {
  ExerciseType,
  WorkoutSessionStatus,
  WorkoutSummaryState,
  WorkoutSummaryView
} from "@/types/workout";

type DatabaseClient = SupabaseClient;

type WorkoutSummaryResult = {
  summary: WorkoutSummaryView | null;
  state: WorkoutSummaryState;
  errorMessage: string | null;
};

type WorkoutSessionRow = {
  id: string;
  user_id: string;
  program_day_id: string | null;
  started_at: string;
  finished_at: string | null;
  status: WorkoutSessionStatus;
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

type WorkoutSessionExerciseRow = {
  id: string;
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
  workout_session_exercise_id: string;
  is_completed: boolean;
};

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

async function selectWorkoutSession(
  client: DatabaseClient,
  sessionId: string,
  userId: string
) {
  const { data, error } = await client
    .from("workout_sessions")
    .select("id, user_id, program_day_id, started_at, finished_at, status")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle<WorkoutSessionRow>();

  if (error) {
    throw new Error(`Failed to load workout session: ${error.message}`);
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
    .select("id, program_week_id, day_number")
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
      "id, exercise_id, exercise_type, order_index, was_swapped, was_added"
    )
    .eq("workout_session_id", workoutSessionId)
    .order("order_index", { ascending: true });

  if (error) {
    throw new Error(`Failed to load workout session exercises: ${error.message}`);
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
    .select("workout_session_exercise_id, is_completed")
    .in("workout_session_exercise_id", workoutSessionExerciseIds)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Failed to load visible workout sets: ${error.message}`);
  }

  return (data ?? []) as WorkoutSetRow[];
}

function buildSummaryView(
  session: WorkoutSessionRow,
  programTitle: string | null,
  programWeekLabel: string,
  workoutSessionExercises: WorkoutSessionExerciseRow[],
  exercises: ExerciseRow[],
  visibleSets: WorkoutSetRow[]
): WorkoutSummaryView {
  const exerciseMap = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const setCounts = new Map<
    string,
    {
      completed: number;
      total: number;
    }
  >();

  visibleSets.forEach((set) => {
    const current = setCounts.get(set.workout_session_exercise_id) ?? {
      completed: 0,
      total: 0
    };

    current.total += 1;
    if (set.is_completed) {
      current.completed += 1;
    }

    setCounts.set(set.workout_session_exercise_id, current);
  });

  const summaryExercises = workoutSessionExercises.map((sessionExercise) => {
    const exercise = exerciseMap.get(sessionExercise.exercise_id);
    const counts = setCounts.get(sessionExercise.id) ?? { completed: 0, total: 0 };

    return {
      id: sessionExercise.id,
      exerciseId: sessionExercise.exercise_id,
      exerciseSlug: exercise?.slug ?? sessionExercise.exercise_id,
      exerciseNameJa: exercise?.name_ja ?? "Exercise",
      exerciseNameEn: exercise?.name_en ?? "Exercise",
      exerciseType: sessionExercise.exercise_type,
      orderIndex: sessionExercise.order_index,
      completedSetCount: counts.completed,
      totalVisibleSetCount: counts.total,
      wasAdded: sessionExercise.was_added,
      wasSwapped: sessionExercise.was_swapped
    };
  });

  return {
    sessionId: session.id,
    userId: session.user_id,
    status: session.status,
    programTitle: programTitle ?? "Current Program",
    programWeekLabel,
    startedAt: session.started_at,
    finishedAt: session.finished_at,
    totalCompletedSets: summaryExercises.reduce(
      (total, exercise) => total + exercise.completedSetCount,
      0
    ),
    totalVisibleSets: summaryExercises.reduce(
      (total, exercise) => total + exercise.totalVisibleSetCount,
      0
    ),
    exercises: summaryExercises
  };
}

export async function getWorkoutSummaryView(
  sessionId: string
): Promise<WorkoutSummaryResult> {
  if (!hasSupabasePublicEnv()) {
    return {
      summary: null,
      state: "error",
      errorMessage: "Supabase is not configured for this environment."
    };
  }

  try {
    const serverClient = createSupabaseServerClient();
    const scopedUser = await serverClient.auth.getUser();
    const userId = scopedUser.data.user?.id ?? null;

    if (!userId) {
      return {
        summary: null,
        state: "unauthenticated",
        errorMessage: "Sign in is required to view this workout summary."
      };
    }

    const queryClient = hasSupabaseServiceRoleEnv()
      ? createSupabaseAdminClient()
      : serverClient;

    const session = await selectWorkoutSession(queryClient, sessionId, userId);

    if (!session) {
      return {
        summary: null,
        state: "not_found",
        errorMessage: "The requested workout session could not be found."
      };
    }

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
    const visibleSets = await selectVisibleWorkoutSets(
      queryClient,
      workoutSessionExercises.map((item) => item.id)
    );

    const summary = buildSummaryView(
      session,
      program?.title ?? null,
      buildProgramWeekLabel(
        programWeek?.week_number ?? null,
        programWeek?.label ?? null,
        programDay?.day_number ?? null
      ),
      workoutSessionExercises,
      exercises,
      visibleSets
    );

    return {
      summary,
      state: session.status === "completed" ? "ready" : "not_completed",
      errorMessage:
        session.status === "completed"
          ? null
          : "This workout session is still in progress."
    };
  } catch (error) {
    console.error("Failed to load workout summary from Supabase.", error);

    return {
      summary: null,
      state: "error",
      errorMessage: "Workout summary could not be loaded right now. Please try again."
    };
  }
}

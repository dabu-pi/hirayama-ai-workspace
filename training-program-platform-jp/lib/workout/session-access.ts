import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WorkoutSessionStatus } from "@/types/workout";

type DatabaseClient = SupabaseClient;

export type AuthenticatedWorkoutContext = {
  client: DatabaseClient;
  userId: string | null;
};

export type OwnedWorkoutSession = {
  id: string;
  user_id: string;
  status: WorkoutSessionStatus;
  finished_at: string | null;
  program_day_id: string | null;
  program_enrollment_id: string | null;
};

export type OwnedWorkoutSessionExercise = {
  id: string;
  workout_session_id: string;
  session: OwnedWorkoutSession;
};

export type OwnedWorkoutSet = {
  id: string;
  workout_session_exercise_id: string;
  set_number: number;
  target_reps_text: string | null;
  weight_kg: number | string | null;
  reps_done: number | null;
  is_auto_filled: boolean;
  is_locked: boolean;
  is_completed: boolean;
  completed_at: string | null;
  deleted_at: string | null;
  sessionExercise: OwnedWorkoutSessionExercise;
};

type SessionExerciseRow = Omit<OwnedWorkoutSessionExercise, "session">;
type WorkoutSetRow = Omit<OwnedWorkoutSet, "sessionExercise">;

// Always use server client so that RLS policies apply correctly.
// Admin client (service role) bypasses RLS and must not be used for
// user-scoped queries.
export function createWorkoutQueryClient(): DatabaseClient {
  return createSupabaseServerClient();
}

export async function getAuthenticatedWorkoutContext(): Promise<AuthenticatedWorkoutContext> {
  const client = createWorkoutQueryClient();
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw new Error(`Failed to resolve authenticated workout user: ${error.message}`);
  }

  return {
    client,
    userId: data.user?.id ?? null
  };
}

export async function getAuthenticatedWorkoutUserId() {
  const { userId } = await getAuthenticatedWorkoutContext();
  return userId;
}

export async function findOwnedWorkoutSession(
  client: DatabaseClient,
  sessionId: string,
  userId: string
): Promise<OwnedWorkoutSession | null> {
  const { data, error } = await client
    .from("workout_sessions")
    .select(
      "id, user_id, status, finished_at, program_day_id, program_enrollment_id"
    )
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle<OwnedWorkoutSession>();

  if (error) {
    throw new Error(`Failed to load owned workout session: ${error.message}`);
  }

  return data;
}

export async function findOwnedWorkoutSessionExercise(
  client: DatabaseClient,
  sessionExerciseId: string,
  userId: string
): Promise<OwnedWorkoutSessionExercise | null> {
  const { data: sessionExercise, error: sessionExerciseError } = await client
    .from("workout_session_exercises")
    .select("id, workout_session_id")
    .eq("id", sessionExerciseId)
    .maybeSingle<SessionExerciseRow>();

  if (sessionExerciseError) {
    throw new Error(
      `Failed to load owned workout session exercise: ${sessionExerciseError.message}`
    );
  }

  if (!sessionExercise) {
    return null;
  }

  const session = await findOwnedWorkoutSession(
    client,
    sessionExercise.workout_session_id,
    userId
  );

  if (!session) {
    return null;
  }

  return {
    ...sessionExercise,
    session
  };
}

export async function findOwnedWorkoutSet(
  client: DatabaseClient,
  setId: string,
  userId: string
): Promise<OwnedWorkoutSet | null> {
  const { data: workoutSet, error: workoutSetError } = await client
    .from("workout_sets")
    .select(
      "id, workout_session_exercise_id, set_number, target_reps_text, weight_kg, reps_done, is_auto_filled, is_locked, is_completed, completed_at, deleted_at"
    )
    .eq("id", setId)
    .maybeSingle<WorkoutSetRow>();

  if (workoutSetError) {
    throw new Error(`Failed to load owned workout set: ${workoutSetError.message}`);
  }

  if (!workoutSet) {
    return null;
  }

  const sessionExercise = await findOwnedWorkoutSessionExercise(
    client,
    workoutSet.workout_session_exercise_id,
    userId
  );

  if (!sessionExercise) {
    return null;
  }

  return {
    ...workoutSet,
    sessionExercise
  };
}

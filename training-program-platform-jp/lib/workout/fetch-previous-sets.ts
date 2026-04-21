import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ExerciseType, PreviousSet } from "@/types/workout";

type HistoricalExerciseRow = {
  id: string;
  workout_session_id: string;
  workout_sessions: { started_at: string } | null;
};

type WorkoutSetRow = {
  set_number: number;
  weight_kg: number | string | null;
  reps_done: number | null;
};

function toNullableNumber(value: number | string | null): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Returns the previous sets for a single (exerciseId, exerciseType) pair,
 * taken from the most recent completed session for the authenticated user.
 *
 * Used after a swap so the client can update previousSets without a full
 * page reload.
 */
export async function fetchPreviousSetsForExercise(
  client: SupabaseClient,
  userId: string,
  exerciseId: string,
  exerciseType: ExerciseType
): Promise<PreviousSet[]> {
  const { data: historicalExercises, error: exError } = await client
    .from("workout_session_exercises")
    .select("id, workout_session_id, workout_sessions!inner(started_at)")
    .eq("exercise_id", exerciseId)
    .eq("exercise_type", exerciseType)
    .eq("workout_sessions.user_id", userId)
    .eq("workout_sessions.status", "completed")
    .is("workout_sessions.archived_at", null)
    .limit(100);

  if (exError || !historicalExercises || historicalExercises.length === 0) {
    return [];
  }

  const typed = historicalExercises as unknown as HistoricalExerciseRow[];

  const latest = typed.reduce((best, cur) => {
    const curAt = cur.workout_sessions?.started_at ?? "";
    const bestAt = best.workout_sessions?.started_at ?? "";
    return curAt > bestAt ? cur : best;
  });

  const { data: sets, error: setsError } = await client
    .from("workout_sets")
    .select("set_number, weight_kg, reps_done")
    .eq("workout_session_exercise_id", latest.id)
    .is("deleted_at", null)
    .order("set_number", { ascending: true });

  if (setsError || !sets) return [];

  const typedSets = sets as WorkoutSetRow[];
  return typedSets.map((s, idx) => ({
    setNumber: idx + 1,
    weightKg: toNullableNumber(s.weight_kg),
    repsDone: s.reps_done
  }));
}

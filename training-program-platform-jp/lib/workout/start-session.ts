import "server-only";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasSupabasePublicEnv,
  hasSupabaseServiceRoleEnv
} from "@/lib/supabase/server";

export type StartSessionResult =
  | { ok: true; sessionId: string }
  | { ok: false; reason: "supabase_unavailable" | "day_not_found" | "insert_failed" };

type ProgramDayExerciseRow = {
  id: string;
  exercise_id: string;
  exercise_type: string;
  set_count: number;
  target_reps_text: string | null;
  order_index: number;
};

type InsertedSessionRow = {
  id: string;
};

type InsertedSessionExerciseRow = {
  id: string;
};

/**
 * Creates a new in_progress workout_session for the given program_day_id.
 *
 * Seed strategy (MVP):
 *   - Reads program_day_exercises for the day, ordered by order_index.
 *   - Creates one workout_session_exercise per exercise.
 *   - Creates set_count empty workout_sets per exercise (target_reps_text copied).
 *   - user_id is set to the authenticated user if available; null otherwise (nullable column).
 *   - program_enrollment_id is not set (enrollment flow is out of scope for this MVP).
 *
 * Returns the new session id on success.
 */
export async function startSessionForDay(
  programDayId: string
): Promise<StartSessionResult> {
  if (!hasSupabasePublicEnv()) {
    return { ok: false, reason: "supabase_unavailable" };
  }

  const serverClient = createSupabaseServerClient();
  const scopedUser = await serverClient.auth.getUser();
  const userId = scopedUser.data.user?.id ?? null;

  const queryClient = hasSupabaseServiceRoleEnv()
    ? createSupabaseAdminClient()
    : serverClient;

  // 1. Verify program_day exists and load its exercises
  const { data: dayExercises, error: dayExercisesError } = await queryClient
    .from("program_day_exercises")
    .select("id, exercise_id, exercise_type, set_count, target_reps_text, order_index")
    .eq("program_day_id", programDayId)
    .order("order_index", { ascending: true });

  if (dayExercisesError) {
    console.error("start-session: failed to load program_day_exercises.", dayExercisesError);
    return { ok: false, reason: "day_not_found" };
  }

  // 2. Create workout_session
  const insertSessionPayload: Record<string, unknown> = {
    program_day_id: programDayId,
    status: "in_progress"
  };
  if (userId) {
    insertSessionPayload.user_id = userId;
  }

  const { data: sessionRow, error: sessionInsertError } = await queryClient
    .from("workout_sessions")
    .insert(insertSessionPayload)
    .select("id")
    .single<InsertedSessionRow>();

  if (sessionInsertError || !sessionRow) {
    console.error("start-session: failed to insert workout_session.", sessionInsertError);
    return { ok: false, reason: "insert_failed" };
  }

  const sessionId = sessionRow.id;

  // 3. Seed exercises + sets if program_day_exercises exist
  const exercises = (dayExercises ?? []) as ProgramDayExerciseRow[];

  for (const exercise of exercises) {
    const { data: sessionExercise, error: exerciseInsertError } = await queryClient
      .from("workout_session_exercises")
      .insert({
        workout_session_id: sessionId,
        exercise_id: exercise.exercise_id,
        exercise_type: exercise.exercise_type,
        order_index: exercise.order_index,
        was_added: false,
        was_swapped: false
      })
      .select("id")
      .single<InsertedSessionExerciseRow>();

    if (exerciseInsertError || !sessionExercise) {
      console.error(
        `start-session: failed to insert session exercise for exercise_id=${exercise.exercise_id}.`,
        exerciseInsertError
      );
      // Continue seeding remaining exercises rather than aborting
      continue;
    }

    const setCount = Math.max(1, exercise.set_count);
    const setsPayload = Array.from({ length: setCount }, (_, i) => ({
      workout_session_exercise_id: sessionExercise.id,
      set_number: i + 1,
      target_reps_text: exercise.target_reps_text,
      weight_kg: null,
      reps_done: null,
      is_completed: false,
      is_locked: false,
      is_auto_filled: false,
      deleted_at: null
    }));

    const { error: setsInsertError } = await queryClient
      .from("workout_sets")
      .insert(setsPayload);

    if (setsInsertError) {
      console.error(
        `start-session: failed to insert sets for session_exercise_id=${sessionExercise.id}.`,
        setsInsertError
      );
    }
  }

  return { ok: true, sessionId };
}

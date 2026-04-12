import "server-only";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasSupabasePublicEnv,
  hasSupabaseServiceRoleEnv
} from "@/lib/supabase/server";

export type StartSessionResult =
  | { ok: true; sessionId: string; reused: boolean }
  | { ok: false; reason: "supabase_unavailable" | "day_not_found" | "insert_failed" };

type ExistingSessionRow = {
  id: string;
};

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

type ProgramDayLabelRow = {
  day_number: number;
  program_weeks: {
    week_number: number;
  } | null;
};

/**
 * Returns the day label string (e.g. "Week 1 / Day 1") for a given program_day_id.
 * Falls back to "Week 1 / Day 1" if unavailable.
 */
export async function getProgramDayLabel(programDayId: string): Promise<string> {
  if (!hasSupabasePublicEnv()) return "Week 1 / Day 1";

  try {
    const client = hasSupabaseServiceRoleEnv()
      ? createSupabaseAdminClient()
      : createSupabaseServerClient();

    const { data, error } = await client
      .from("program_days")
      .select("day_number, program_weeks(week_number)")
      .eq("id", programDayId)
      .maybeSingle<ProgramDayLabelRow>();

    if (error || !data) return "Week 1 / Day 1";

    const weekNumber = data.program_weeks?.week_number ?? 1;
    const dayNumber = data.day_number;
    return `Week ${weekNumber} / Day ${dayNumber}`;
  } catch {
    return "Week 1 / Day 1";
  }
}

/**
 * Creates (or reuses) an in_progress workout_session for the given program_day_id.
 *
 * Duplicate prevention:
 *   - Checks for an existing in_progress session with the same program_day_id.
 *   - If found, returns it immediately with reused=true (no new insert).
 *
 * Seed strategy (MVP):
 *   - Reads program_day_exercises for the day, ordered by order_index.
 *   - Creates one workout_session_exercise per exercise.
 *   - Creates set_count empty workout_sets per exercise (target_reps_text copied).
 *   - user_id is set to the authenticated user if available; null otherwise (nullable column).
 *   - program_enrollment_id is not set (enrollment flow is out of scope for this MVP).
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

  // 0. Guard: check for an existing in_progress session for this day
  //    Prevents duplicate sessions on button double-tap or page reload.
  {
    let existingQuery = queryClient
      .from("workout_sessions")
      .select("id")
      .eq("program_day_id", programDayId)
      .eq("status", "in_progress")
      .limit(1);

    if (userId) {
      existingQuery = existingQuery.eq("user_id", userId);
    }

    const { data: existing, error: existingError } =
      await existingQuery.maybeSingle<ExistingSessionRow>();

    if (existingError) {
      console.error("start-session: failed to check for existing session.", existingError);
      return { ok: false, reason: "insert_failed" };
    }

    if (existing) {
      return { ok: true, sessionId: existing.id, reused: true };
    }
  }

  // 1. Load program_day_exercises
  const { data: dayExercises, error: dayExercisesError } = await queryClient
    .from("program_day_exercises")
    .select("id, exercise_id, exercise_type, set_count, target_reps_text, order_index")
    .eq("program_day_id", programDayId)
    .order("order_index", { ascending: true });

  if (dayExercisesError) {
    console.error("start-session: failed to load program_day_exercises.", dayExercisesError);
    return { ok: false, reason: "day_not_found" };
  }

  // 2. Insert workout_session
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

  // 3. Seed exercises + sets
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

  return { ok: true, sessionId, reused: false };
}

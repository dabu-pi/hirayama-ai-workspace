import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";
import { findOrCreateEnrollment } from "@/lib/workout/enrollment";

export type StartSessionResult =
  | { ok: true; sessionId: string; reused: boolean }
  | {
      ok: false;
      reason:
        | "supabase_unavailable"
        | "unauthenticated"
        | "day_not_found"
        | "insert_failed"
        | "session_already_in_progress";
    };

type ExistingSessionRow = {
  id: string;
  program_day_id: string | null;
};

type ProgramDayExerciseRow = {
  id: string;
  exercise_id: string;
  exercise_type: string;
  set_count: number;
  target_reps_text: string | null;
  order_index: number;
  swap_group_slug: string | null;
};

type InsertedSessionRow = {
  id: string;
};

type InsertedSessionExerciseRow = {
  id: string;
  exercise_id: string;
  order_index: number;
};

type ProgramDayRow = {
  id: string;
  program_week_id: string;
};

type ProgramWeekRow = {
  program_id: string;
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
    const client = createSupabaseServerClient();

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
 * Resolves program_id from program_day_id via program_days → program_weeks.
 */
async function resolveProgramIdFromDayId(
  programDayId: string,
  client: SupabaseClient
): Promise<string | null> {
  const { data: day, error: dayError } = await client
    .from("program_days")
    .select("id, program_week_id")
    .eq("id", programDayId)
    .maybeSingle<ProgramDayRow>();

  if (dayError || !day) return null;

  const { data: week, error: weekError } = await client
    .from("program_weeks")
    .select("program_id")
    .eq("id", day.program_week_id)
    .maybeSingle<ProgramWeekRow>();

  if (weekError || !week) return null;

  return week.program_id;
}

/**
 * Creates (or reuses) an in_progress workout_session for the given program_day_id.
 *
 * Enrollment:
 *   - find-or-create active enrollment for (userId, programId)
 *   - link session.program_enrollment_id to enrollment.id
 *
 * Duplicate prevention:
 *   - Checks for an existing in_progress session with the same program_day_id.
 *   - If found, returns it immediately with reused=true (no new insert).
 *
 * Seed strategy (MVP):
 *   - Reads program_day_exercises for the day, ordered by order_index.
 *   - Creates one workout_session_exercise per exercise.
 *   - Creates set_count empty workout_sets per exercise (target_reps_text copied).
 *   - user_id is always the authenticated user.
 */
export async function startSessionForDay(
  programDayId: string
): Promise<StartSessionResult> {
  if (!hasSupabasePublicEnv()) {
    return { ok: false, reason: "supabase_unavailable" };
  }

  // Always use server client so that RLS policies apply correctly.
  // Admin client (service role) bypasses RLS and must not be used for
  // user-scoped queries.
  const client = createSupabaseServerClient();
  const scopedUser = await client.auth.getUser();
  const userId = scopedUser.data.user?.id ?? null;

  if (!userId) {
    return { ok: false, reason: "unauthenticated" };
  }

  // 0. Guard: check for any existing in_progress session for this user.
  //    - Same program_day_id → reuse (idempotent resume).
  //    - Different session (custom or different day) → block.
  //    User-scope check ensures a custom (program_day_id=null) session cannot
  //    silently coexist with a program-based session.
  {
    const { data: anyInProgress, error: existingError } = await client
      .from("workout_sessions")
      .select("id, program_day_id")
      .eq("user_id", userId)
      .eq("status", "in_progress")
      .is("archived_at", null)
      .limit(1)
      .maybeSingle<ExistingSessionRow>();

    if (existingError) {
      console.error("start-session: failed to check for existing session.", existingError);
      return { ok: false, reason: "insert_failed" };
    }

    if (anyInProgress) {
      if (anyInProgress.program_day_id === programDayId) {
        return { ok: true, sessionId: anyInProgress.id, reused: true };
      }
      console.warn("start-session: blocked by existing in_progress session.", {
        existingSessionId: anyInProgress.id,
        existingProgramDayId: anyInProgress.program_day_id,
        requestedProgramDayId: programDayId
      });
      return { ok: false, reason: "session_already_in_progress" };
    }
  }

  // 1. Load program_day_exercises
  const { data: dayExercises, error: dayExercisesError } = await client
    .from("program_day_exercises")
    .select("id, exercise_id, exercise_type, set_count, target_reps_text, order_index, swap_group_slug")
    .eq("program_day_id", programDayId)
    .order("order_index", { ascending: true });

  if (dayExercisesError) {
    console.error("start-session: failed to load program_day_exercises.", dayExercisesError);
    return { ok: false, reason: "day_not_found" };
  }

  // 2. Find-or-create enrollment
  const programId = await resolveProgramIdFromDayId(programDayId, client);
  let enrollmentId: string | null = null;

  if (programId) {
    const enrollment = await findOrCreateEnrollment(programId, programDayId, userId);
    enrollmentId = enrollment?.id ?? null;
  }

  // 3. Insert workout_session (linked to enrollment if available)
  const insertSessionPayload: Record<string, unknown> = {
    program_day_id: programDayId,
    user_id: userId,
    status: "in_progress"
  };
  if (enrollmentId) {
    insertSessionPayload.program_enrollment_id = enrollmentId;
  }

  const { data: sessionRow, error: sessionInsertError } = await client
    .from("workout_sessions")
    .insert(insertSessionPayload)
    .select("id")
    .single<InsertedSessionRow>();

  if (sessionInsertError || !sessionRow) {
    console.error("start-session: failed to insert workout_session.", sessionInsertError);
    return { ok: false, reason: "insert_failed" };
  }

  const sessionId = sessionRow.id;

  // 4. Seed exercises + sets — batch insert instead of N serial round-trips.
  // Before: 2 queries per exercise (N×2 sequential). After: 2 queries total.
  const exercises = (dayExercises ?? []) as ProgramDayExerciseRow[];

  if (exercises.length > 0) {
    const exercisesInsertPayload = exercises.map((exercise) => ({
      workout_session_id: sessionId,
      exercise_id: exercise.exercise_id,
      exercise_type: exercise.exercise_type,
      order_index: exercise.order_index,
      was_added: false,
      was_swapped: false,
      ...(exercise.swap_group_slug != null
        ? { swap_group_slug: exercise.swap_group_slug }
        : {})
    }));

    const { data: sessionExerciseRows, error: exerciseBatchError } = await client
      .from("workout_session_exercises")
      .insert(exercisesInsertPayload)
      .select("id, exercise_id, order_index");

    if (exerciseBatchError || !sessionExerciseRows) {
      console.error("start-session: failed to batch insert session exercises.", exerciseBatchError);
      // Session was created — return it even though exercises/sets are missing.
      return { ok: true, sessionId, reused: false };
    }

    // Map returned rows back to source exercises by exercise_id + order_index.
    // PostgreSQL returns RETURNING rows in insertion order, but use a map for safety.
    const exerciseRowMap = new Map(
      (sessionExerciseRows as InsertedSessionExerciseRow[]).map((row) => [
        `${row.exercise_id}:${row.order_index}`,
        row.id
      ])
    );

    const setsInsertPayload = exercises.flatMap((exercise) => {
      const sessionExerciseId = exerciseRowMap.get(
        `${exercise.exercise_id}:${exercise.order_index}`
      );
      if (!sessionExerciseId) return [];
      const setCount = Math.max(1, exercise.set_count);
      return Array.from({ length: setCount }, (_, i) => ({
        workout_session_exercise_id: sessionExerciseId,
        set_number: i + 1,
        target_reps_text: exercise.target_reps_text,
        weight_kg: null,
        reps_done: null,
        is_completed: false,
        is_locked: false,
        is_auto_filled: false,
        deleted_at: null
      }));
    });

    if (setsInsertPayload.length > 0) {
      const { error: setsError } = await client.from("workout_sets").insert(setsInsertPayload);
      if (setsError) {
        console.error("start-session: failed to batch insert sets.", setsError);
      }
    }
  }

  return { ok: true, sessionId, reused: false };
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

type EnrollmentRow = {
  id: string;
  user_id: string;
  program_id: string;
  current_program_day_id: string | null;
  status: "active" | "paused" | "completed";
  started_at: string;
  updated_at: string;
};

type ProgramDayRow = {
  id: string;
  day_number: number;
  program_week_id: string;
};

type ProgramWeekRow = {
  id: string;
  week_number: number;
  program_id: string;
};

// ---------------------------------------------------------------------------
// Client helper
// ---------------------------------------------------------------------------

// Always use server client so that RLS policies apply correctly.
// Admin client (service role) bypasses RLS and must not be used for
// user-scoped queries.
function createQueryClient(): SupabaseClient {
  return createSupabaseServerClient();
}

// ---------------------------------------------------------------------------
// findActiveEnrollment
// ---------------------------------------------------------------------------

/**
 * Returns the active enrollment for the given (userId, programId) pair.
 */
export async function findActiveEnrollment(
  programId: string,
  userId: string | null
): Promise<EnrollmentRow | null> {
  if (!hasSupabasePublicEnv()) return null;
  if (!userId) return null;

  try {
    const client = createQueryClient();

    const { data, error } = await client
      .from("program_enrollments")
      .select(
        "id, user_id, program_id, current_program_day_id, status, started_at, updated_at"
      )
      .eq("program_id", programId)
      .eq("status", "active")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle<EnrollmentRow>();

    if (error) {
      console.error("enrollment: failed to find active enrollment.", error);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// findOrCreateEnrollment
// ---------------------------------------------------------------------------

/**
 * Finds an active enrollment for (userId, programId), or creates one
 * pointing to firstProgramDayId.
 *
 * Returns null when Supabase is unavailable or the insert fails.
 */
export async function findOrCreateEnrollment(
  programId: string,
  firstProgramDayId: string,
  userId: string
): Promise<EnrollmentRow | null> {
  if (!hasSupabasePublicEnv()) return null;

  try {
    const client = createQueryClient();

    const existing = await findActiveEnrollment(programId, userId);
    if (existing) return existing;

    const { data, error } = await client
      .from("program_enrollments")
      .insert({
        program_id: programId,
        current_program_day_id: firstProgramDayId,
        status: "active",
        user_id: userId
      })
      .select(
        "id, user_id, program_id, current_program_day_id, status, started_at, updated_at"
      )
      .single<EnrollmentRow>();

    if (error || !data) {
      console.error("enrollment: failed to create enrollment.", error);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// resolveStartProgramDayId
// ---------------------------------------------------------------------------

/**
 * Returns the program_day_id to start from for the given program:
 *   1. active enrollment's current_program_day_id
 *   2. firstProgramDayId (week 1 / day 1 fallback)
 *   3. null (Supabase unavailable)
 */
export async function resolveStartProgramDayId(
  programId: string,
  firstProgramDayId: string | null,
  userId: string | null
): Promise<{ startProgramDayId: string | null; hasActiveEnrollment: boolean }> {
  if (!hasSupabasePublicEnv()) {
    return { startProgramDayId: firstProgramDayId, hasActiveEnrollment: false };
  }
  if (!userId) {
    return { startProgramDayId: firstProgramDayId, hasActiveEnrollment: false };
  }

  try {
    const enrollment = await findActiveEnrollment(programId, userId);

    if (enrollment?.current_program_day_id) {
      return {
        startProgramDayId: enrollment.current_program_day_id,
        hasActiveEnrollment: true
      };
    }

    return { startProgramDayId: firstProgramDayId, hasActiveEnrollment: false };
  } catch {
    return { startProgramDayId: firstProgramDayId, hasActiveEnrollment: false };
  }
}

// ---------------------------------------------------------------------------
// findNextProgramDayId
// ---------------------------------------------------------------------------

/**
 * Given a completed program_day_id, returns the UUID of the next day:
 *   - same week, day_number + 1  (if exists)
 *   - next week, day_number = 1  (if exists)
 *   - null                       (program completed)
 */
export async function findNextProgramDayId(
  currentProgramDayId: string
): Promise<string | null> {
  if (!hasSupabasePublicEnv()) return null;

  try {
    const client = createQueryClient();

    // Load current day
    const { data: currentDay, error: currentDayError } = await client
      .from("program_days")
      .select("id, day_number, program_week_id")
      .eq("id", currentProgramDayId)
      .maybeSingle<ProgramDayRow>();

    if (currentDayError || !currentDay) return null;

    // Load current week
    const { data: currentWeek, error: currentWeekError } = await client
      .from("program_weeks")
      .select("id, week_number, program_id")
      .eq("id", currentDay.program_week_id)
      .maybeSingle<ProgramWeekRow>();

    if (currentWeekError || !currentWeek) return null;

    // Try next day in the same week
    const { data: nextDay } = await client
      .from("program_days")
      .select("id")
      .eq("program_week_id", currentDay.program_week_id)
      .eq("day_number", currentDay.day_number + 1)
      .maybeSingle<{ id: string }>();

    if (nextDay) return nextDay.id;

    // Try day 1 of the next week
    const { data: nextWeek } = await client
      .from("program_weeks")
      .select("id")
      .eq("program_id", currentWeek.program_id)
      .eq("week_number", currentWeek.week_number + 1)
      .maybeSingle<{ id: string }>();

    if (!nextWeek) return null; // program fully completed

    const { data: firstDayOfNextWeek } = await client
      .from("program_days")
      .select("id")
      .eq("program_week_id", nextWeek.id)
      .eq("day_number", 1)
      .maybeSingle<{ id: string }>();

    return firstDayOfNextWeek?.id ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// advanceEnrollmentAfterSessionComplete
// ---------------------------------------------------------------------------

/**
 * Called after a workout_session is finished.
 * Looks up the active enrollment linked to the session and advances it:
 *   - next day exists → update current_program_day_id
 *   - next day null   → mark enrollment as completed, keep current_program_day_id
 *                       (so the UI can display "you finished this program")
 *
 * Design note on final day:
 *   current_program_day_id is kept as the last completed day (not nulled).
 *   Rationale: nulling it loses information about where the user was.
 *   The UI can check status='completed' to know the program is done.
 *
 * Idempotency guard (D-3):
 *   Advancement only occurs when enrollment.current_program_day_id matches
 *   session.program_day_id. If the enrollment has already moved past the
 *   session's day (e.g. a stale session for an old day is re-finished, or a
 *   new session was started for an already-completed day), this function
 *   returns without modifying the enrollment. This prevents both regression
 *   (rolling back to an earlier day) and double-advance.
 *
 * Silently returns on any error — session finish should not fail because of enrollment.
 */
export async function advanceEnrollmentAfterSessionComplete(
  workoutSessionId: string,
  userId?: string
): Promise<void> {
  if (!hasSupabasePublicEnv()) return;

  try {
    const client = createQueryClient();

    // 1. Load session to get program_day_id and program_enrollment_id
    type SessionRow = {
      id: string;
      user_id: string;
      program_day_id: string | null;
      program_enrollment_id: string | null;
    };

    let sessionQuery = client
      .from("workout_sessions")
      .select("id, user_id, program_day_id, program_enrollment_id")
      .eq("id", workoutSessionId);

    if (userId) {
      sessionQuery = sessionQuery.eq("user_id", userId);
    }

    const { data: session, error: sessionError } = await sessionQuery.maybeSingle<SessionRow>();

    if (
      sessionError ||
      !session?.program_enrollment_id ||
      !session.program_day_id ||
      !session.user_id
    ) {
      return;
    }

    // 2. Verify enrollment exists and is still active
    const { data: enrollment, error: enrollmentError } = await client
      .from("program_enrollments")
      .select("id, user_id, status, current_program_day_id")
      .eq("id", session.program_enrollment_id)
      .eq("status", "active")
      .eq("user_id", session.user_id)
      .maybeSingle<Pick<EnrollmentRow, "id" | "user_id" | "status" | "current_program_day_id">>();

    if (enrollmentError || !enrollment) return;

    // 3. Idempotency guard: only advance when the session's day is still the
    //    enrollment's current day. If current_program_day_id has already moved
    //    past session.program_day_id, the day was already processed — skip.
    if (enrollment.current_program_day_id !== session.program_day_id) {
      return;
    }

    // 4. Find next day
    const nextDayId = await findNextProgramDayId(session.program_day_id);

    if (nextDayId) {
      // Advance to next day
      await client
        .from("program_enrollments")
        .update({
          current_program_day_id: nextDayId,
          updated_at: new Date().toISOString()
        })
        .eq("id", enrollment.id);
    } else {
      // Program completed — mark as completed, keep last day for reference
      await client
        .from("program_enrollments")
        .update({
          status: "completed",
          updated_at: new Date().toISOString()
        })
        .eq("id", enrollment.id);
    }
  } catch (error) {
    console.error("enrollment: failed to advance enrollment after session complete.", error);
  }
}

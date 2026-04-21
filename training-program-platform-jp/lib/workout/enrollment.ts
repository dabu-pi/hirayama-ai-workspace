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
      .is("archived_at", null)
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

    // Do NOT filter by status='active' here. An enrollment with status='paused'
    // or 'completed' still has a unique (user_id, program_id) row, so an INSERT
    // would fail with a duplicate-key error. We only need the id for linking the
    // session; the caller doesn't require the enrollment to be active.
    const { data: existing } = await client
      .from("program_enrollments")
      .select(
        "id, user_id, program_id, current_program_day_id, status, started_at, updated_at"
      )
      .eq("user_id", userId)
      .eq("program_id", programId)
      .is("archived_at", null)
      .limit(1)
      .maybeSingle<EnrollmentRow>();

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
 *   - null                       (program completed — next day genuinely absent)
 *
 * IMPORTANT: throws on DB query errors. Callers MUST NOT treat a throw as
 * "program complete" — it means the result is indeterminate. The most common
 * caller, advanceEnrollmentAfterSessionComplete, handles this by leaving the
 * enrollment unchanged rather than incorrectly marking it as completed.
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

    if (currentDayError) throw new Error(`program_days lookup failed: ${currentDayError.message}`);
    if (!currentDay) return null; // day not in program structure — treat as structural end

    // Load current week
    const { data: currentWeek, error: currentWeekError } = await client
      .from("program_weeks")
      .select("id, week_number, program_id")
      .eq("id", currentDay.program_week_id)
      .maybeSingle<ProgramWeekRow>();

    if (currentWeekError) throw new Error(`program_weeks lookup failed: ${currentWeekError.message}`);
    if (!currentWeek) return null; // week not found — structural end

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
      .is("archived_at", null)
      .eq("user_id", session.user_id)
      .maybeSingle<Pick<EnrollmentRow, "id" | "user_id" | "status" | "current_program_day_id">>();

    if (enrollmentError || !enrollment) return;

    // 3. Idempotency guard: only advance when the session's day is still the
    //    enrollment's current day. If current_program_day_id has already moved
    //    past session.program_day_id, the day was already processed — skip.
    if (enrollment.current_program_day_id !== session.program_day_id) {
      return;
    }

    // 4. Find next day.
    // findNextProgramDayId throws on DB errors. Catch here to avoid treating
    // a query failure as program completion (which would incorrectly set status='completed').
    // On failure, leave enrollment unchanged — the S-4 idempotent re-finish path
    // in the finish route will retry on next session complete.
    let nextDayId: string | null;
    try {
      nextDayId = await findNextProgramDayId(session.program_day_id);
    } catch (nextDayError) {
      console.error("enrollment: findNextProgramDayId failed — leaving enrollment unchanged", {
        enrollmentId: enrollment.id,
        programDayId: session.program_day_id,
        error: nextDayError instanceof Error ? nextDayError.message : String(nextDayError)
      });
      return;
    }

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

// ---------------------------------------------------------------------------
// getTrainFallbackView
// ---------------------------------------------------------------------------

type TrainFallbackEnrollmentRow = {
  id: string;
  program_id: string;
  current_program_day_id: string | null;
};

type TrainFallbackProgramRow = {
  slug: string;
};

type TrainFallbackSessionRow = {
  program_day_id: string | null;
};

export type TrainFallbackView = {
  programSlug: string;
  programDayId: string;
};

/**
 * Lightweight fallback for the naked /train path when getActiveProgramView
 * returns no views or when the primary view has actionType="none".
 *
 * Two strategies, tried in order:
 *
 * Strategy 1 — enrollment-based:
 *   Queries program_enrollments with status IN ('active','paused') to tolerate
 *   cases where advancement incorrectly marks the enrollment as non-active.
 *   Resolves the actionable day via:
 *     (a) enrollment.current_program_day_id  (if set)
 *     (b) findNextProgramDayId(lastSession.program_day_id)  (if a is null)
 *
 * Strategy 2 — session-based:
 *   Bypasses enrollment entirely. Finds the most recent completed/cancelled
 *   session for the user and resolves the target day:
 *     cancelled → retry the same day (program_day_id)
 *     completed → advance via findNextProgramDayId
 *   Resolves program slug via day → week → program chain (no RLS risk).
 *
 * Returns null when no actionable day can be resolved.
 * Never throws — all errors return null silently.
 */
export async function getTrainFallbackView(userId: string): Promise<TrainFallbackView | null> {
  if (!hasSupabasePublicEnv()) return null;

  try {
    const client = createQueryClient();

    // ── Strategy 1: enrollment-based ─────────────────────────────────────────
    // Include 'paused' to tolerate enrollment status drift after advancement.
    const { data: enrollment } = await client
      .from("program_enrollments")
      .select("id, program_id, current_program_day_id")
      .eq("user_id", userId)
      .in("status", ["active", "paused"])
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<TrainFallbackEnrollmentRow>();

    if (enrollment) {
      const { data: program } = await client
        .from("programs")
        .select("slug")
        .eq("id", enrollment.program_id)
        .maybeSingle<TrainFallbackProgramRow>();

      if (program?.slug) {
        let programDayId: string | null = enrollment.current_program_day_id;

        if (!programDayId) {
          const { data: lastEnrollmentSession } = await client
            .from("workout_sessions")
            .select("program_day_id")
            .eq("program_enrollment_id", enrollment.id)
            .in("status", ["completed", "cancelled"])
            .is("archived_at", null)
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle<TrainFallbackSessionRow>();

          if (lastEnrollmentSession?.program_day_id) {
            programDayId = await findNextProgramDayId(lastEnrollmentSession.program_day_id);
          }
        }

        if (programDayId) return { programSlug: program.slug, programDayId };
      }
    }

    // ── Strategy 2: session-based (bypasses enrollment entirely) ─────────────
    // Used when enrollment is absent, archived, or in an unrecoverable status.
    const { data: lastSession } = await client
      .from("workout_sessions")
      .select("program_day_id, status")
      .eq("user_id", userId)
      .in("status", ["completed", "cancelled"])
      .is("archived_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ program_day_id: string | null; status: string }>();

    if (!lastSession?.program_day_id) return null;

    // cancelled → retry same day; completed → advance to next day
    const targetDayId: string | null =
      lastSession.status === "completed"
        ? await findNextProgramDayId(lastSession.program_day_id)
        : lastSession.program_day_id;

    if (!targetDayId) return null;

    // Resolve slug via program_days → program_weeks → programs
    // All three tables are readable by everyone (anon + authenticated) — no RLS risk.
    const { data: dayRow } = await client
      .from("program_days")
      .select("program_week_id")
      .eq("id", targetDayId)
      .maybeSingle<{ program_week_id: string }>();

    if (!dayRow) return null;

    const { data: weekRow } = await client
      .from("program_weeks")
      .select("program_id")
      .eq("id", dayRow.program_week_id)
      .maybeSingle<{ program_id: string }>();

    if (!weekRow) return null;

    const { data: programRow } = await client
      .from("programs")
      .select("slug")
      .eq("id", weekRow.program_id)
      .maybeSingle<TrainFallbackProgramRow>();

    if (!programRow?.slug) return null;
    return { programSlug: programRow.slug, programDayId: targetDayId };
  } catch {
    return null;
  }
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";
import { findActiveEnrollment } from "@/lib/workout/enrollment";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RestartProgramResult =
  | {
      ok: true;
      enrollmentId: string;
      programDayId: string;
      reused: boolean;
    }
  | {
      ok: false;
      reason:
        | "supabase_unavailable"
        | "unauthenticated"
        | "program_not_found"
        | "first_day_not_found"
        | "insert_failed";
    };

type InsertedEnrollmentRow = {
  id: string;
};

type ProgramExistsRow = {
  id: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * S-7: Resolves the UUID of the first program_day (Week 1 / Day 1) for the
 * given program. Returns null when the program has no week 1 / day 1, i.e.
 * broken or empty program data.
 *
 * This is identical to the resolver used by workout-summary.ts for the
 * Restart CTA firstProgramDayId — duplicated here so the restart endpoint
 * does not depend on summary internals.
 */
async function resolveFirstProgramDayId(
  client: SupabaseClient,
  programId: string
): Promise<string | null> {
  const { data: week1, error: week1Error } = await client
    .from("program_weeks")
    .select("id")
    .eq("program_id", programId)
    .eq("week_number", 1)
    .maybeSingle<{ id: string }>();

  if (week1Error || !week1) return null;

  const { data: day1, error: day1Error } = await client
    .from("program_days")
    .select("id")
    .eq("program_week_id", week1.id)
    .eq("day_number", 1)
    .maybeSingle<{ id: string }>();

  if (day1Error) return null;

  return day1?.id ?? null;
}

// ---------------------------------------------------------------------------
// Main action
// ---------------------------------------------------------------------------

/**
 * S-7: Restarts a program for the signed-in user.
 *
 * Semantics (re-enrollment, NOT reset):
 *   - A completed enrollment is a historical record and is left untouched.
 *   - A brand new active enrollment is inserted, pointing at Week 1 / Day 1.
 *   - If the user already has an active enrollment for this program (e.g.
 *     they clicked Restart twice, or somehow an active enrollment still
 *     exists alongside the completed one), the existing active enrollment
 *     is returned — no duplicate row is created.
 *
 * Idempotency:
 *   findActiveEnrollment() + INSERT is not atomic, but for the realistic
 *   user flow (two quick clicks from the same browser session) the second
 *   call will see the first insert and return reused=true. The UI layer
 *   also disables the button during the in-flight request.
 *
 * Failure modes:
 *   - program_not_found: given programId doesn't resolve to a program row
 *   - first_day_not_found: program exists but has no Week 1 / Day 1
 *     (broken data) — enrollment is NOT created, caller should surface error
 *   - insert_failed: DB error during insert
 */
export async function restartProgramEnrollment(
  programId: string,
  userId: string
): Promise<RestartProgramResult> {
  if (!hasSupabasePublicEnv()) {
    return { ok: false, reason: "supabase_unavailable" };
  }

  if (!userId) {
    return { ok: false, reason: "unauthenticated" };
  }

  try {
    const client = createSupabaseServerClient();

    // 1. Verify program exists (prevents creating an enrollment for a bogus
    //    programId that sneaks past auth).
    const { data: program, error: programError } = await client
      .from("programs")
      .select("id")
      .eq("id", programId)
      .maybeSingle<ProgramExistsRow>();

    if (programError || !program) {
      return { ok: false, reason: "program_not_found" };
    }

    // 2. Resolve first program_day. If this fails the program is broken;
    //    do NOT create an enrollment with a null current_program_day_id —
    //    the user would land on a program that can't be started.
    const firstProgramDayId = await resolveFirstProgramDayId(client, programId);

    if (!firstProgramDayId) {
      return { ok: false, reason: "first_day_not_found" };
    }

    // 3. Idempotency: if an active enrollment already exists for this program,
    //    return it. Covers:
    //      - rapid double-click from the Summary CTA
    //      - edge case where a prior run didn't actually complete (rare)
    const existing = await findActiveEnrollment(programId, userId);
    if (existing) {
      return {
        ok: true,
        enrollmentId: existing.id,
        programDayId: existing.current_program_day_id ?? firstProgramDayId,
        reused: true
      };
    }

    // 4. Insert new active enrollment. Completed enrollments for the same
    //    (userId, programId) are intentionally left in place as history.
    //    The DB's active-only UNIQUE constraint (WHERE status='active') does
    //    NOT block this insert because no active row currently exists.
    const { data: inserted, error: insertError } = await client
      .from("program_enrollments")
      .insert({
        program_id: programId,
        current_program_day_id: firstProgramDayId,
        status: "active",
        user_id: userId
      })
      .select("id")
      .single<InsertedEnrollmentRow>();

    if (insertError || !inserted) {
      console.error(
        "restart-program: failed to insert new active enrollment.",
        insertError
      );
      return { ok: false, reason: "insert_failed" };
    }

    return {
      ok: true,
      enrollmentId: inserted.id,
      programDayId: firstProgramDayId,
      reused: false
    };
  } catch (error) {
    console.error("restart-program: unexpected error.", error);
    return { ok: false, reason: "insert_failed" };
  }
}

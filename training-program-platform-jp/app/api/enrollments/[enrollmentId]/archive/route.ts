import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv
} from "@/lib/supabase/server";
import {
  getAuthenticatedWorkoutContext,
  isLikelyUuid
} from "@/lib/workout/session-access";

type RouteContext = {
  params: {
    enrollmentId: string;
  };
};

type EnrollmentRow = {
  id: string;
  user_id: string;
  status: string;
  archived_at: string | null;
};

/**
 * POST /api/enrollments/[enrollmentId]/archive
 *
 * Soft-archives an enrollment — sets archived_at = now().
 * Archived enrollments are excluded from active-program views and
 * enrollment detection queries (selectActiveEnrollments, findActiveEnrollment,
 * train-entry enrollment lookup).
 *
 * Idempotency: already-archived enrollments return 200 no-op.
 * Any status (active / paused / completed) may be archived.
 */
export async function POST(_request: Request, { params }: RouteContext) {
  if (!isLikelyUuid(params.enrollmentId)) {
    return NextResponse.json(
      { error: { code: "invalid_enrollment_id_format", message: "Enrollment id must be a UUID." } },
      { status: 400 }
    );
  }

  try {
    const { client: authClient, userId } = await getAuthenticatedWorkoutContext();

    if (!userId) {
      return NextResponse.json(
        { error: { code: "unauthenticated", message: "ログインが必要です。" } },
        { status: 401 }
      );
    }

    const dbClient = hasSupabaseServiceRoleEnv()
      ? createSupabaseAdminClient()
      : authClient;

    // Verify ownership
    const { data: enrollment, error: lookupError } = await dbClient
      .from("program_enrollments")
      .select("id, user_id, status, archived_at")
      .eq("id", params.enrollmentId)
      .eq("user_id", userId)
      .maybeSingle<EnrollmentRow>();

    if (lookupError) {
      return NextResponse.json(
        { error: { code: "enrollment_lookup_failed", message: "Enrollment lookup failed." } },
        { status: 500 }
      );
    }

    if (!enrollment) {
      return NextResponse.json(
        { error: { code: "enrollment_not_found", message: "Program enrollment was not found." } },
        { status: 404 }
      );
    }

    // Idempotent — already archived
    if (enrollment.archived_at !== null) {
      return NextResponse.json({ id: enrollment.id, archived: true, noOp: true });
    }

    const now = new Date().toISOString();

    const { error: updateError } = await dbClient
      .from("program_enrollments")
      .update({ archived_at: now })
      .eq("id", params.enrollmentId)
      .eq("user_id", userId);

    if (updateError) {
      return NextResponse.json(
        { error: { code: "archive_failed", message: "Failed to archive enrollment." } },
        { status: 500 }
      );
    }

    // Also archive any in_progress sessions for this enrollment so that
    // /train's getCurrentWorkoutSessionView (which filters archived_at IS NULL)
    // no longer picks them up. Completed/cancelled sessions are left untouched
    // to preserve training history.
    const { error: sessionsUpdateError } = await dbClient
      .from("workout_sessions")
      .update({ archived_at: now })
      .eq("program_enrollment_id", params.enrollmentId)
      .eq("status", "in_progress")
      .is("archived_at", null);

    if (sessionsUpdateError) {
      // Non-fatal: log and continue. The enrollment is already archived.
      console.warn("archive enrollment: failed to archive linked sessions", {
        enrollmentId: params.enrollmentId,
        error: sessionsUpdateError.message
      });
    }

    revalidatePath("/programs");
    revalidatePath("/train");
    revalidatePath("/");

    return NextResponse.json({ id: params.enrollmentId, archived: true, noOp: false });
  } catch (error) {
    console.error("Failed to archive program enrollment.", error);
    return NextResponse.json(
      { error: { code: "archive_unexpected_error", message: "Unexpected error." } },
      { status: 500 }
    );
  }
}

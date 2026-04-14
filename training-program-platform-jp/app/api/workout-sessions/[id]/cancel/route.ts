import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  createWorkoutQueryClient,
  getAuthenticatedWorkoutUserId
} from "@/lib/workout/session-access";

type RouteContext = {
  params: {
    id: string;
  };
};

type SessionRow = {
  id: string;
  user_id: string;
  status: "in_progress" | "completed" | "cancelled";
};

/**
 * S-5: POST /api/workout-sessions/[id]/cancel
 *
 * Marks an in_progress session as cancelled.
 * Enrollment is intentionally NOT advanced — current_program_day_id stays unchanged
 * so the user can restart the same day via Home / /train.
 *
 * Idempotency:
 *   - already-cancelled  → 200 no-op (safe retry)
 *   - completed session  → 409 (can't cancel a completed session)
 *   - not found / auth   → 404 / 401
 *
 * Data policy:
 *   Sets and exercises are NOT deleted. status='cancelled' is the only mutation.
 *   Cancelled sessions are excluded from Home trend / e1RM / volume queries
 *   (those already filter on status='completed' only).
 */
export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const userId = await getAuthenticatedWorkoutUserId();

    if (!userId) {
      return NextResponse.json(
        {
          error: {
            code: "unauthenticated",
            message: "ログインが必要です。"
          }
        },
        { status: 401 }
      );
    }

    const supabase = createWorkoutQueryClient();

    const { data: session, error: sessionError } = await supabase
      .from("workout_sessions")
      .select("id, user_id, status")
      .eq("id", params.id)
      .eq("user_id", userId)
      .maybeSingle<SessionRow>();

    if (sessionError) {
      return NextResponse.json(
        {
          error: {
            code: "session_lookup_failed",
            message: "Workout session lookup failed."
          }
        },
        { status: 500 }
      );
    }

    if (!session) {
      return NextResponse.json(
        {
          error: {
            code: "session_not_found",
            message: "Workout session was not found."
          }
        },
        { status: 404 }
      );
    }

    // Already cancelled — idempotent success, nothing to do
    if (session.status === "cancelled") {
      return NextResponse.json({ id: session.id, status: "cancelled" });
    }

    // Completed sessions cannot be cancelled
    if (session.status === "completed") {
      return NextResponse.json(
        {
          error: {
            code: "session_already_completed",
            message: "Completed sessions cannot be cancelled."
          }
        },
        { status: 409 }
      );
    }

    // Cancel the in_progress session.
    // Extra WHERE clause (.eq("status", "in_progress")) provides a concurrency
    // guard — if the session was completed by another request in flight, this
    // update affects 0 rows and we return success anyway (the session is done).
    const { error: updateError } = await supabase
      .from("workout_sessions")
      .update({ status: "cancelled" })
      .eq("id", params.id)
      .eq("status", "in_progress");

    if (updateError) {
      return NextResponse.json(
        {
          error: {
            code: "session_cancel_failed",
            message: "Failed to cancel workout session."
          }
        },
        { status: 500 }
      );
    }

    // NOTE: advanceEnrollmentAfterSessionComplete is intentionally NOT called.
    // enrollment.current_program_day_id is preserved so the user can start the
    // same day again from Home or /train.

    revalidatePath("/train");
    revalidatePath("/"); // Home CTA transitions from "Resume" → "Start next workout"

    return NextResponse.json({ id: params.id, status: "cancelled" });
  } catch (error) {
    console.error("Failed to cancel workout session.", error);

    return NextResponse.json(
      {
        error: {
          code: "cancel_unexpected_error",
          message: "Unexpected error occurred while cancelling workout session."
        }
      },
      { status: 500 }
    );
  }
}

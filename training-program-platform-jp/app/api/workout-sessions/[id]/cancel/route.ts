import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv
} from "@/lib/supabase/server";
import {
  findOwnedWorkoutSession,
  getAuthenticatedWorkoutContext
} from "@/lib/workout/session-access";

type RouteContext = {
  params: {
    id: string;
  };
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
    const routeName = "workout-session-cancel";
    // Auth check via server client (cookie-based auth.getUser())
    const { client: authClient, userId } = await getAuthenticatedWorkoutContext();

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

    // DB operations use admin client when available to avoid JWT/RLS pass-through
    // issues in Route Handlers (auth.getUser() can refresh in-memory but PostgREST
    // may still receive an expired token). Security: explicit .eq("user_id", userId).
    const dbClient = hasSupabaseServiceRoleEnv()
      ? createSupabaseAdminClient()
      : authClient;

    console.info(`${routeName}:start`, {
      sessionId: params.id,
      userId,
      dbClientType: hasSupabaseServiceRoleEnv() ? "admin" : "server"
    });

    let session;
    try {
      session = await findOwnedWorkoutSession(dbClient, params.id, userId);
    } catch (lookupError) {
      const le = lookupError instanceof Error ? lookupError : new Error(String(lookupError));
      console.error("Failed to resolve workout session before cancel.", {
        sessionId: params.id,
        userId,
        errorMessage: le.message,
        errorStack: le.stack
      });
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
    console.info(`${routeName}:lookup`, {
      sessionId: params.id,
      userId,
      found: Boolean(session),
      status: session?.status ?? null
    });

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
    const { data: updatedSession, error: updateError } = await dbClient
      .from("workout_sessions")
      .update({ status: "cancelled" })
      .eq("id", params.id)
      .eq("user_id", userId)
      .eq("status", "in_progress")
      .select("id, status")
      .maybeSingle<{ id: string; status: "cancelled" }>();

    if (updateError) {
      console.error(`${routeName}:update_error`, {
        sessionId: params.id,
        userId,
        updateError
      });
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
    if (!updatedSession) {
      console.warn(`${routeName}:update_conflict`, {
        sessionId: params.id,
        userId
      });
      return NextResponse.json(
        {
          error: {
            code: "session_cancel_conflict",
            message: "Workout session could not be cancelled."
          }
        },
        { status: 409 }
      );
    }
    console.info(`${routeName}:update_success`, {
      sessionId: updatedSession.id,
      userId,
      status: updatedSession.status
    });

    // NOTE: advanceEnrollmentAfterSessionComplete is intentionally NOT called.
    // enrollment.current_program_day_id is preserved so the user can start the
    // same day again from Home or /train.

    revalidatePath("/train");
    revalidatePath("/"); // Home CTA transitions from "Resume" → "Start next workout"

    return NextResponse.json({ id: updatedSession.id, status: updatedSession.status });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("workout-session-cancel:unexpected_error", {
      sessionId: params.id,
      name: err.name,
      message: err.message,
      stack: err.stack
    });

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

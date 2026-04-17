import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv
} from "@/lib/supabase/server";
import {
  classifySupabaseQueryError,
  findOwnedWorkoutSession,
  getAuthenticatedWorkoutContext,
  isLikelyUuid,
  type WorkoutQueryFailureCause
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
  const routeName = "workout-session-cancel";
  const sessionIdIsUuid = isLikelyUuid(params.id);

  // Hard guard: non-UUID ids (mock sessions, malformed client input) never
  // reach PostgREST. Returning 400 here yields a clear cause in logs instead
  // of a 500 caused by invalid_text_representation.
  if (!sessionIdIsUuid) {
    console.warn(`${routeName}:invalid_session_id_format`, {
      sessionId: params.id,
      cause: "query_bad_request" satisfies WorkoutQueryFailureCause
    });
    return NextResponse.json(
      {
        error: {
          code: "invalid_session_id_format",
          message: "Session id must be a UUID."
        }
      },
      { status: 400 }
    );
  }

  try {
    // Auth check via server client (cookie-based auth.getUser())
    const {
      client: authClient,
      userId,
      authSource
    } = await getAuthenticatedWorkoutContext();

    if (!userId) {
      console.warn(`${routeName}:cause`, {
        sessionId: params.id,
        sessionIdIsUuid,
        authSource,
        cause: "auth_failed" satisfies WorkoutQueryFailureCause
      });
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
    const usingAdmin = hasSupabaseServiceRoleEnv();
    const dbClient = usingAdmin ? createSupabaseAdminClient() : authClient;
    const dbClientType: "admin" | "token" | "cookie" = usingAdmin
      ? "admin"
      : authSource === "token"
        ? "token"
        : "cookie";

    console.info(`${routeName}:start`, {
      sessionId: params.id,
      userId,
      sessionIdIsUuid,
      authSource,
      dbClientType
    });

    // Early warning: mock / non-UUID session IDs (e.g. "session-demo-20260411")
    // will be rejected by PostgREST as 400 22P02. We log here explicitly so the
    // cause appears in logs even before the first DB call.
    if (!sessionIdIsUuid) {
      console.warn(`${routeName}:sessionId_not_uuid`, {
        sessionId: params.id,
        note: "PostgREST will reject non-UUID ids with 400 22P02"
      });
    }

    let session;
    try {
      session = await findOwnedWorkoutSession(dbClient, params.id, userId, {
        queryName: "findOwnedWorkoutSessionForCancel",
        route: routeName,
        authSource
      });
    } catch (lookupError) {
      const le =
        lookupError instanceof Error
          ? lookupError
          : new Error(String(lookupError));
      const pgErr = (lookupError as unknown as { pgErr?: Record<string, unknown> })
        .pgErr;
      const cause = !sessionIdIsUuid
        ? ("query_bad_request" satisfies WorkoutQueryFailureCause)
        : classifySupabaseQueryError(pgErr ?? null);
      console.error(`${routeName}:cause`, {
        failedQuery: "findOwnedWorkoutSessionForCancel",
        sessionId: params.id,
        userId,
        sessionIdIsUuid,
        authSource,
        cause,
        errorMessage: le.message
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
      console.info(`${routeName}:cause`, {
        sessionId: params.id,
        userId,
        sessionIdIsUuid,
        authSource,
        cause: "session_not_found"
      });
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
    const cancelUpdateFilters = {
      id: params.id,
      user_id: userId,
      status: "in_progress"
    };
    console.info("workout-query:start", {
      route: routeName,
      queryName: "cancelUpdate",
      table: "workout_sessions",
      op: "update.select.maybeSingle",
      set: { status: "cancelled" },
      filters: cancelUpdateFilters,
      sessionIdIsUuid,
      authSource,
      dbClientType
    });

    const { data: updatedSession, error: updateError } = await dbClient
      .from("workout_sessions")
      .update({ status: "cancelled" })
      .eq("id", params.id)
      .eq("user_id", userId)
      .eq("status", "in_progress")
      .select("id, status")
      .maybeSingle<{ id: string; status: "cancelled" }>();

    if (updateError) {
      const pgErr = updateError as unknown as Record<string, unknown>;
      const cause = classifySupabaseQueryError(pgErr);
      console.error("workout-query:error", {
        route: routeName,
        queryName: "cancelUpdate",
        table: "workout_sessions",
        op: "update.select.maybeSingle",
        filters: cancelUpdateFilters,
        sessionIdIsUuid,
        authSource,
        dbClientType,
        cause,
        errorCode: pgErr.code,
        errorStatus: pgErr.status ?? pgErr.statusCode,
        errorMessage: updateError.message,
        errorHint: pgErr.hint,
        errorDetails: pgErr.details
      });
      console.error(`${routeName}:cause`, {
        failedQuery: "cancelUpdate",
        sessionId: params.id,
        userId,
        sessionIdIsUuid,
        authSource,
        cause
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
        userId,
        note: "cancelUpdate affected 0 rows — another request may have completed the session"
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
    console.error(`${routeName}:unexpected_error`, {
      sessionId: params.id,
      sessionIdIsUuid,
      name: err.name,
      message: err.message,
      stack: err.stack
    });
    console.error(`${routeName}:cause`, {
      sessionId: params.id,
      sessionIdIsUuid,
      cause: "unknown" satisfies WorkoutQueryFailureCause,
      errorMessage: err.message
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

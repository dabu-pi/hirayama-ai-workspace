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
 *   Sets and exercises are NOT deleted.
 *   status='cancelled' and archived_at=now() so the session is
 *   immediately excluded from all user-facing history / display queries
 *   without requiring a manual archive step.
 *   Trend / e1RM / volume queries already filter on status='completed' only.
 *
 * Performance (Optimistic UPDATE):
 *   Normal case: UPDATE with status='in_progress' filter → 1 RT total (no pre-SELECT).
 *   Fallback: only when UPDATE returns 0 rows, a SELECT determines the cause
 *   (already-cancelled → 200, completed → 409, not found → 404).
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

  const t0 = Date.now();

  try {
    // Auth check via server client (cookie-based auth.getUser())
    const {
      client: authClient,
      userId,
      authSource
    } = await getAuthenticatedWorkoutContext();
    console.log(`[PERF] cancel auth: ${Date.now() - t0}ms | authSource=${authSource ?? "unauthenticated"}`);

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

    // Optimistic UPDATE: attempt to cancel directly without a pre-SELECT.
    // Filters (id + user_id + status='in_progress') guarantee:
    //   - ownership (user_id = authenticated user)
    //   - only in_progress sessions are cancelled
    // If 1 row is returned → fast path success.
    // If 0 rows returned (null) → fallback SELECT to determine the cause.
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
      set: { status: "cancelled", archived_at: "<now>" },
      filters: cancelUpdateFilters,
      sessionIdIsUuid,
      authSource,
      dbClientType
    });

    const tUpdate = Date.now();
    const { data: updatedSession, error: updateError } = await dbClient
      .from("workout_sessions")
      .update({ status: "cancelled", archived_at: new Date().toISOString() })
      .eq("id", params.id)
      .eq("user_id", userId)
      .eq("status", "in_progress")
      .select("id, status")
      .maybeSingle<{ id: string; status: "cancelled" }>();
    console.log(`[PERF] cancel update: ${Date.now() - tUpdate}ms | error=${String(updateError?.message ?? "none")}`);

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

    // Fast path: UPDATE hit the in_progress row — session is now cancelled.
    if (updatedSession) {
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
      revalidatePath("/programs"); // Programs enrollment card → no longer shows active session

      console.log(`[PERF] cancel TOTAL: ${Date.now() - t0}ms | sessionId=${params.id} | path=optimistic`);
      return NextResponse.json({ id: updatedSession.id, status: updatedSession.status });
    }

    // Fallback: UPDATE returned 0 rows — the session is not in_progress for this user.
    // Issue a SELECT to determine the precise cause (cancelled / completed / not found).
    const tLookup = Date.now();
    let session;
    try {
      session = await findOwnedWorkoutSession(dbClient, params.id, userId, {
        queryName: "cancelFallbackLookup",
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
      const cause = classifySupabaseQueryError(pgErr ?? null);
      console.error(`${routeName}:cause`, {
        failedQuery: "cancelFallbackLookup",
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
    console.log(`[PERF] cancel lookup(fallback): ${Date.now() - tLookup}ms | found=${Boolean(session)} | status=${session?.status ?? "null"}`);
    console.info(`${routeName}:fallback_lookup`, {
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
      console.log(`[PERF] cancel TOTAL: ${Date.now() - t0}ms | sessionId=${params.id} | path=fallback_not_found`);
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

    // Already cancelled — idempotent success
    if (session.status === "cancelled") {
      console.log(`[PERF] cancel TOTAL: ${Date.now() - t0}ms | sessionId=${params.id} | path=fallback_already_cancelled`);
      return NextResponse.json({ id: session.id, status: "cancelled" });
    }

    // Completed sessions cannot be cancelled
    if (session.status === "completed") {
      console.log(`[PERF] cancel TOTAL: ${Date.now() - t0}ms | sessionId=${params.id} | path=fallback_completed`);
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

    // Unexpected status — treat as conflict
    console.warn(`${routeName}:update_conflict`, {
      sessionId: params.id,
      userId,
      sessionStatus: session.status,
      note: "cancelUpdate affected 0 rows with unexpected session status"
    });
    console.log(`[PERF] cancel TOTAL: ${Date.now() - t0}ms | sessionId=${params.id} | path=fallback_conflict`);
    return NextResponse.json(
      {
        error: {
          code: "session_cancel_conflict",
          message: "Workout session could not be cancelled."
        }
      },
      { status: 409 }
    );
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

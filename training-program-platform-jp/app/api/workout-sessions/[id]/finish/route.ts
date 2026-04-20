import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { advanceEnrollmentAfterSessionComplete } from "@/lib/workout/enrollment";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv
} from "@/lib/supabase/server";
import {
  findOwnedWorkoutSession,
  getAuthenticatedWorkoutContext,
  isLikelyUuid
} from "@/lib/workout/session-access";
import { updateT1ProgressionAfterSession } from "@/lib/workout/t1-progression";

type RouteContext = {
  params: {
    id: string;
  };
};

type FinishRequestBody = {
  forceFinish?: boolean;
};

type WorkoutSessionExerciseRow = {
  id: string;
};

async function countIncompleteSets(
  workoutSessionId: string,
  supabase: SupabaseClient
) {
  const { data: sessionExercises, error: sessionExercisesError } = await supabase
    .from("workout_session_exercises")
    .select("id")
    .eq("workout_session_id", workoutSessionId);

  if (sessionExercisesError) {
    // Non-blocking: log and treat as 0 incomplete sets so the route can proceed.
    // Finish must not hard-fail because of a count query error.
    console.warn("workout-session-finish:incomplete_count_exercises_error", {
      sessionId: workoutSessionId,
      error: sessionExercisesError.message
    });
    return 0;
  }

  const sessionExerciseIds = ((sessionExercises ?? []) as WorkoutSessionExerciseRow[]).map(
    (item) => item.id
  );

  if (sessionExerciseIds.length === 0) {
    return 0;
  }

  const { count, error: incompleteCountError } = await supabase
    .from("workout_sets")
    .select("id", { count: "exact", head: true })
    .in("workout_session_exercise_id", sessionExerciseIds)
    .is("deleted_at", null)
    .eq("is_completed", false);

  if (incompleteCountError) {
    console.warn("workout-session-finish:incomplete_count_sets_error", {
      sessionId: workoutSessionId,
      error: incompleteCountError.message
    });
    return 0;
  }

  return count ?? 0;
}

export async function POST(request: Request, { params }: RouteContext) {
  const routeName = "workout-session-finish";

  // Hard guard: non-UUID ids never reach PostgREST (would yield 400 22P02).
  if (!isLikelyUuid(params.id)) {
    console.warn(`${routeName}:invalid_session_id_format`, {
      sessionId: params.id,
      cause: "query_bad_request"
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
    const body = (await request.json().catch(() => ({}))) as FinishRequestBody;
    const forceFinish = body.forceFinish === true;
    const summaryPath = `/workout-summary/${params.id}`;
    // Auth check via server client (cookie-based auth.getUser())
    const {
      client: authClient,
      userId
    } = await getAuthenticatedWorkoutContext();

    if (!userId) {
      return NextResponse.json(
        {
          error: {
            code: "unauthenticated",
            message: "ログインすると Finish を実行できます。"
          }
        },
        { status: 401 }
      );
    }

    // DB operations use admin client when available — same rationale as cancel route.
    const dbClient = hasSupabaseServiceRoleEnv()
      ? createSupabaseAdminClient()
      : authClient;

    console.info(`${routeName}:start`, {
      sessionId: params.id,
      userId,
      forceFinish,
      dbClientType: hasSupabaseServiceRoleEnv() ? "admin" : "server"
    });

    let session;
    try {
      session = await findOwnedWorkoutSession(dbClient, params.id, userId);
    } catch (lookupError) {
      const le = lookupError instanceof Error ? lookupError : new Error(String(lookupError));
      console.error(`${routeName}:lookup_error`, {
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

    const incompleteSetCount = await countIncompleteSets(params.id, dbClient);
    console.info(`${routeName}:incomplete_count`, {
      sessionId: params.id,
      userId,
      incompleteSetCount
    });

    if (session.status === "completed") {
      // S-4: Recovery path — if the session was previously marked complete but
      // enrollment advancement silently failed (network error, DB blip), retrying
      // the finish request would have skipped advanceEnrollmentAfterSessionComplete
      // and left the enrollment permanently stuck on the old day.
      //
      // By calling advance here too, we get idempotent recovery for free:
      //   - If enrollment already advanced → idempotency guard in advance() returns immediately.
      //   - If enrollment was NOT advanced → advance() completes it now.
      await advanceEnrollmentAfterSessionComplete(params.id, userId);

      return NextResponse.json({
        id: session.id,
        status: "completed",
        finishedAt: session.finished_at,
        incompleteSetCount,
        summaryPath
      });
    }

    if (incompleteSetCount > 0 && !forceFinish) {
      return NextResponse.json(
        {
          id: session.id,
          status: session.status,
          finishedAt: session.finished_at,
          incompleteSetCount,
          summaryPath,
          requiresConfirmation: true,
          message: `${incompleteSetCount} sets are still incomplete.`
        },
        { status: 409 }
      );
    }

    const finishedAt = new Date().toISOString();
    const { data: updatedSession, error: updateError } = await dbClient
      .from("workout_sessions")
      .update({
        status: "completed",
        finished_at: finishedAt
      })
      .eq("id", params.id)
      .eq("user_id", userId)
      .eq("status", "in_progress")
      .select("id, status, finished_at")
      .maybeSingle<{
        id: string;
        status: "completed";
        finished_at: string | null;
      }>();

    if (updateError) {
      console.error(`${routeName}:update_error`, {
        sessionId: params.id,
        userId,
        updateError
      });
      return NextResponse.json(
        {
          error: {
            code: "session_finish_failed",
            message: "Failed to finish workout session."
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
            code: "session_finish_conflict",
            message: "Workout session could not be finished."
          }
        },
        { status: 409 }
      );
    }
    console.info(`${routeName}:update_success`, {
      sessionId: updatedSession.id,
      userId,
      status: updatedSession.status,
      finishedAt: updatedSession.finished_at
    });

    // Advance enrollment to next day (silent — does not fail the request on error)
    await advanceEnrollmentAfterSessionComplete(params.id, userId);

    // Update T1 progression state (silent — does not fail the request on error).
    // Called only on the primary completion path, not on S-4 idempotent re-finish,
    // to prevent double-advancing the weight.
    await updateT1ProgressionAfterSession(params.id, userId, dbClient);

    revalidatePath("/train");
    revalidatePath("/");
    revalidatePath("/programs");       // Programs enrollment banner → shows W1D2
    revalidatePath("/session-history"); // History → shows completed session immediately

    return NextResponse.json({
      id: updatedSession.id,
      status: updatedSession.status,
      finishedAt: updatedSession.finished_at,
      incompleteSetCount,
      summaryPath
    });
  } catch (error) {
    console.error("Failed to finish workout session.", error);

    return NextResponse.json(
      {
        error: {
          code: "session_finish_unexpected_error",
          message: "Unexpected error occurred while finishing workout session."
        }
      },
      { status: 500 }
    );
  }
}

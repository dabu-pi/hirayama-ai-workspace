import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { advanceEnrollmentAfterSessionComplete } from "@/lib/workout/enrollment";
import {
  findOwnedWorkoutSession,
  getAuthenticatedWorkoutContext
} from "@/lib/workout/session-access";

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
    throw new Error(
      `Failed to load session exercises for finish: ${sessionExercisesError.message}`
    );
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
    throw new Error(
      `Failed to count incomplete sets for finish: ${incompleteCountError.message}`
    );
  }

  return count ?? 0;
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const routeName = "workout-session-finish";
    const body = (await request.json().catch(() => ({}))) as FinishRequestBody;
    const forceFinish = body.forceFinish === true;
    const summaryPath = `/workout-summary/${params.id}`;
    const { client: supabase, userId } = await getAuthenticatedWorkoutContext();

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
    console.info(`${routeName}:start`, {
      sessionId: params.id,
      userId,
      forceFinish
    });

    let session;
    try {
      session = await findOwnedWorkoutSession(supabase, params.id, userId);
    } catch (lookupError) {
      console.error(`${routeName}:lookup_error`, {
        sessionId: params.id,
        userId,
        lookupError
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

    const incompleteSetCount = await countIncompleteSets(params.id, supabase);
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
    const { data: updatedSession, error: updateError } = await supabase
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

    revalidatePath("/train");
    revalidatePath("/"); // Ensure Home progress / CTA reflects new enrollment state

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

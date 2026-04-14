import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { advanceEnrollmentAfterSessionComplete } from "@/lib/workout/enrollment";
import {
  createWorkoutQueryClient,
  getAuthenticatedWorkoutUserId
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
  supabase: ReturnType<typeof createWorkoutQueryClient>
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
    const body = (await request.json().catch(() => ({}))) as FinishRequestBody;
    const forceFinish = body.forceFinish === true;
    const summaryPath = `/workout-summary/${params.id}`;
    const userId = await getAuthenticatedWorkoutUserId();

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

    const supabase = createWorkoutQueryClient();

    const { data: session, error: sessionError } = await supabase
      .from("workout_sessions")
      .select("id, user_id, status, finished_at")
      .eq("id", params.id)
      .eq("user_id", userId)
      .maybeSingle<{
        id: string;
        user_id: string;
        status: "in_progress" | "completed" | "cancelled";
        finished_at: string | null;
      }>();

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

    const incompleteSetCount = await countIncompleteSets(params.id, supabase);

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
    const { error: updateError } = await supabase
      .from("workout_sessions")
      .update({
        status: "completed",
        finished_at: finishedAt
      })
      .eq("id", params.id);

    if (updateError) {
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

    // Advance enrollment to next day (silent — does not fail the request on error)
    await advanceEnrollmentAfterSessionComplete(params.id, userId);

    revalidatePath("/train");
    revalidatePath("/"); // Ensure Home progress / CTA reflects new enrollment state

    return NextResponse.json({
      id: params.id,
      status: "completed",
      finishedAt,
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

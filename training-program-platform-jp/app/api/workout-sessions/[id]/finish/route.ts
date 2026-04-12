import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasSupabaseServiceRoleEnv
} from "@/lib/supabase/server";
import { advanceEnrollmentAfterSessionComplete } from "@/lib/workout/enrollment";

type RouteContext = {
  params: {
    id: string;
  };
};

type FinishRequestBody = {
  forceFinish?: boolean;
};

type WorkoutSessionRow = {
  id: string;
  user_id: string;
  status: "in_progress" | "completed" | "cancelled";
  finished_at: string | null;
};

type WorkoutSessionExerciseRow = {
  id: string;
};

async function countIncompleteSets(
  workoutSessionId: string,
  createClient: typeof createSupabaseAdminClient | typeof createSupabaseServerClient
) {
  const supabase = createClient();
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
    const serverClient = createSupabaseServerClient();
    const scopedUser = await serverClient.auth.getUser();
    const userId = scopedUser.data.user?.id ?? null;
    const createClient = hasSupabaseServiceRoleEnv()
      ? createSupabaseAdminClient
      : createSupabaseServerClient;
    const supabase = createClient();

    let sessionQuery = supabase
      .from("workout_sessions")
      .select("id, user_id, status, finished_at")
      .eq("id", params.id);

    if (userId) {
      sessionQuery = sessionQuery.eq("user_id", userId);
    }

    const { data: session, error: sessionError } =
      await sessionQuery.maybeSingle<WorkoutSessionRow>();

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

    const incompleteSetCount = await countIncompleteSets(params.id, createClient);

    if (session.status === "completed") {
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
    await advanceEnrollmentAfterSessionComplete(params.id);

    revalidatePath("/train");

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

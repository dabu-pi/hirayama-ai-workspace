import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  createWorkoutQueryClient,
  findOwnedWorkoutSession,
  getAuthenticatedWorkoutUserId
} from "@/lib/workout/session-access";

type RouteContext = {
  params: {
    id: string;
    exerciseId: string;
  };
};

type SwapRequestBody = {
  exercise_id?: string;
};

type SessionExerciseRow = {
  id: string;
  workout_session_id: string;
  exercise_id: string;
  exercise_type: string;
  order_index: number;
  was_swapped: boolean;
};

type ExerciseRow = {
  id: string;
  slug: string;
  name_ja: string;
  name_en: string;
};

type BlockingSetRow = {
  id: string;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json().catch(() => ({}))) as SwapRequestBody;
    const newExerciseId = body.exercise_id;

    if (!newExerciseId || typeof newExerciseId !== "string") {
      return NextResponse.json(
        {
          error: {
            code: "invalid_request",
            message: "exercise_id is required."
          }
        },
        { status: 400 }
      );
    }

    const userId = await getAuthenticatedWorkoutUserId();

    if (!userId) {
      return NextResponse.json(
        {
          error: {
            code: "unauthenticated",
            message: "ログインすると種目の入れ替えができます。"
          }
        },
        { status: 401 }
      );
    }

    const supabase = createWorkoutQueryClient();

    let session;
    try {
      session = await findOwnedWorkoutSession(supabase, params.id, userId);
    } catch {
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

    if (session.status === "completed") {
      return NextResponse.json(
        {
          error: {
            code: "session_completed",
            message: "Cannot swap exercise in a completed session."
          }
        },
        { status: 409 }
      );
    }

    const { data: sessionExercise, error: sessionExerciseError } = await supabase
      .from("workout_session_exercises")
      .select("id, workout_session_id, exercise_id, exercise_type, order_index, was_swapped")
      .eq("id", params.exerciseId)
      .eq("workout_session_id", session.id)
      .maybeSingle<SessionExerciseRow>();

    if (sessionExerciseError) {
      return NextResponse.json(
        {
          error: {
            code: "session_exercise_lookup_failed",
            message: "Workout session exercise lookup failed."
          }
        },
        { status: 500 }
      );
    }

    if (!sessionExercise) {
      return NextResponse.json(
        {
          error: {
            code: "session_exercise_not_found",
            message: "Workout session exercise was not found in this session."
          }
        },
        { status: 404 }
      );
    }

    if (sessionExercise.exercise_id === newExerciseId) {
      const { data: currentExercise } = await supabase
        .from("exercises")
        .select("id, slug, name_ja, name_en")
        .eq("id", sessionExercise.exercise_id)
        .maybeSingle<ExerciseRow>();

      return NextResponse.json({
        noOp: true,
        sessionExercise: {
          id: sessionExercise.id,
          exerciseId: sessionExercise.exercise_id,
          exerciseSlug: currentExercise?.slug ?? sessionExercise.exercise_id,
          exerciseNameJa: currentExercise?.name_ja ?? "Exercise",
          exerciseNameEn: currentExercise?.name_en ?? "Exercise",
          exerciseType: sessionExercise.exercise_type,
          wasSwapped: sessionExercise.was_swapped
        }
      });
    }

    const { data: newExercise, error: newExerciseError } = await supabase
      .from("exercises")
      .select("id, slug, name_ja, name_en")
      .eq("id", newExerciseId)
      .maybeSingle<ExerciseRow>();

    if (newExerciseError) {
      return NextResponse.json(
        {
          error: {
            code: "exercise_lookup_failed",
            message: "Exercise lookup failed."
          }
        },
        { status: 500 }
      );
    }

    if (!newExercise) {
      return NextResponse.json(
        {
          error: {
            code: "exercise_not_found",
            message: "Exercise was not found."
          }
        },
        { status: 404 }
      );
    }

    const { data: blockingSets, error: blockingSetsError } = await supabase
      .from("workout_sets")
      .select("id")
      .eq("workout_session_exercise_id", sessionExercise.id)
      .is("deleted_at", null)
      .or(
        "is_completed.eq.true,is_locked.eq.true,weight_kg.not.is.null,reps_done.not.is.null"
      )
      .limit(1);

    if (blockingSetsError) {
      return NextResponse.json(
        {
          error: {
            code: "set_check_failed",
            message: "Failed to check set state for swap."
          }
        },
        { status: 500 }
      );
    }

    if (((blockingSets ?? []) as BlockingSetRow[]).length > 0) {
      return NextResponse.json(
        {
          error: {
            code: "swap_blocked_by_input",
            message:
              "Cannot swap: one or more sets have been completed or have input. Remove inputs and unlock all sets before swapping."
          }
        },
        { status: 409 }
      );
    }

    const { error: updateError } = await supabase
      .from("workout_session_exercises")
      .update({
        exercise_id: newExerciseId,
        exercise_type: "T3",
        was_swapped: true
      })
      .eq("id", sessionExercise.id);

    if (updateError) {
      return NextResponse.json(
        {
          error: {
            code: "swap_update_failed",
            message: "Failed to swap exercise."
          }
        },
        { status: 500 }
      );
    }

    revalidatePath("/train");

    return NextResponse.json({
      noOp: false,
      sessionExercise: {
        id: sessionExercise.id,
        exerciseId: newExercise.id,
        exerciseSlug: newExercise.slug,
        exerciseNameJa: newExercise.name_ja,
        exerciseNameEn: newExercise.name_en,
        exerciseType: "T3",
        wasSwapped: true
      }
    });
  } catch (error) {
    console.error("Failed to swap exercise in workout session.", error);

    return NextResponse.json(
      {
        error: {
          code: "swap_unexpected_error",
          message: "Unexpected error occurred while swapping exercise."
        }
      },
      { status: 500 }
    );
  }
}

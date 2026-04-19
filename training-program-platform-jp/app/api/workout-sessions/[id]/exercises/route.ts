import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  findOwnedWorkoutSession,
  getAuthenticatedWorkoutContext,
  isLikelyUuid
} from "@/lib/workout/session-access";

type RouteContext = {
  params: {
    id: string;
  };
};

type AddExerciseRequestBody = {
  exercise_id?: string;
};

type ExerciseRow = {
  id: string;
  slug: string;
  name_ja: string;
  name_en: string;
};

type OrderIndexRow = {
  order_index: number;
};

type InsertedSessionExerciseRow = {
  id: string;
  workout_session_id: string;
  exercise_id: string;
  exercise_type: string;
  order_index: number;
  was_added: boolean;
};

type InsertedWorkoutSetRow = {
  id: string;
  workout_session_exercise_id: string;
  set_number: number;
  target_reps_text: string | null;
  weight_kg: number | null;
  reps_done: number | null;
  is_completed: boolean;
  is_locked: boolean;
  completed_at: string | null;
  is_auto_filled: boolean;
  deleted_at: string | null;
};

export async function POST(request: Request, { params }: RouteContext) {
  const routeName = "workout-session-add-exercise";

  // Hard guard: non-UUID session ids never reach PostgREST.
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
    const body = (await request.json().catch(() => ({}))) as AddExerciseRequestBody;
    const exerciseId = body.exercise_id;

    if (!exerciseId || typeof exerciseId !== "string") {
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

    const { client: supabase, userId } = await getAuthenticatedWorkoutContext();

    if (!userId) {
      return NextResponse.json(
        {
          error: {
            code: "unauthenticated",
            message: "ログインすると種目を追加できます。"
          }
        },
        { status: 401 }
      );
    }

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

    if (session.status !== "in_progress") {
      return NextResponse.json(
        {
          error: {
            code: "session_not_in_progress",
            message: "Only in-progress sessions can be edited."
          }
        },
        { status: 409 }
      );
    }

    const { data: exercise, error: exerciseError } = await supabase
      .from("exercises")
      .select("id, slug, name_ja, name_en")
      .eq("id", exerciseId)
      .maybeSingle<ExerciseRow>();

    if (exerciseError) {
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

    if (!exercise) {
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

    const { data: existingExercises, error: existingError } = await supabase
      .from("workout_session_exercises")
      .select("order_index")
      .eq("workout_session_id", session.id)
      .order("order_index", { ascending: false })
      .limit(1);

    if (existingError) {
      return NextResponse.json(
        {
          error: {
            code: "order_index_lookup_failed",
            message: "Failed to determine order_index."
          }
        },
        { status: 500 }
      );
    }

    const maxOrderIndex =
      ((existingExercises ?? []) as OrderIndexRow[])[0]?.order_index ?? 0;
    const newOrderIndex = maxOrderIndex + 1;

    const { data: insertedExercise, error: insertExerciseError } = await supabase
      .from("workout_session_exercises")
      .insert({
        workout_session_id: session.id,
        exercise_id: exerciseId,
        exercise_type: "T3",
        order_index: newOrderIndex,
        was_added: true,
        was_swapped: false
      })
      .select(
        "id, workout_session_id, exercise_id, exercise_type, order_index, was_added"
      )
      .single<InsertedSessionExerciseRow>();

    if (insertExerciseError || !insertedExercise) {
      return NextResponse.json(
        {
          error: {
            code: "exercise_insert_failed",
            message: "Failed to add exercise to session."
          }
        },
        { status: 500 }
      );
    }

    const { data: insertedSet, error: insertSetError } = await supabase
      .from("workout_sets")
      .insert({
        workout_session_exercise_id: insertedExercise.id,
        set_number: 1,
        target_reps_text: null,
        weight_kg: null,
        reps_done: null,
        is_completed: false,
        is_locked: false,
        is_auto_filled: false,
        deleted_at: null
      })
      .select(
        "id, workout_session_exercise_id, set_number, target_reps_text, weight_kg, reps_done, is_completed, is_locked, completed_at, is_auto_filled, deleted_at"
      )
      .single<InsertedWorkoutSetRow>();

    if (insertSetError || !insertedSet) {
      return NextResponse.json(
        {
          error: {
            code: "initial_set_insert_failed",
            message: "Exercise added but initial set creation failed."
          }
        },
        { status: 500 }
      );
    }

    revalidatePath("/train");

    return NextResponse.json({
      sessionExercise: {
        id: insertedExercise.id,
        exerciseId: insertedExercise.exercise_id,
        exerciseSlug: exercise.slug,
        exerciseNameJa: exercise.name_ja,
        exerciseNameEn: exercise.name_en,
        exerciseType: insertedExercise.exercise_type,
        orderIndex: insertedExercise.order_index,
        wasAdded: insertedExercise.was_added
      },
      initialSet: {
        id: insertedSet.id,
        workoutSessionExerciseId: insertedSet.workout_session_exercise_id,
        setNumber: insertedSet.set_number,
        targetRepsText: insertedSet.target_reps_text,
        weightKg: insertedSet.weight_kg,
        repsDone: insertedSet.reps_done,
        isCompleted: insertedSet.is_completed,
        isLocked: insertedSet.is_locked,
        completedAt: insertedSet.completed_at,
        isAutoFilled: insertedSet.is_auto_filled,
        previousDisplay: "-",
        deletedAt: insertedSet.deleted_at
      }
    });
  } catch (error) {
    console.error("Failed to add exercise to workout session.", error);

    return NextResponse.json(
      {
        error: {
          code: "add_exercise_unexpected_error",
          message: "Unexpected error occurred while adding exercise."
        }
      },
      { status: 500 }
    );
  }
}

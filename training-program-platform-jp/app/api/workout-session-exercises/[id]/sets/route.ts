import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  createWorkoutQueryClient,
  findOwnedWorkoutSessionExercise,
  getAuthenticatedWorkoutUserId
} from "@/lib/workout/session-access";

type RouteContext = {
  params: {
    id: string;
  };
};

type ExistingWorkoutSetRow = {
  set_number: number;
  target_reps_text: string | null;
  deleted_at: string | null;
};

type InsertedWorkoutSetRow = {
  id: string;
  workout_session_exercise_id: string;
  set_number: number;
  target_reps_text: string | null;
  weight_kg: number | string | null;
  reps_done: number | null;
  is_completed: boolean;
  is_locked: boolean;
  completed_at: string | null;
  is_auto_filled: boolean;
  deleted_at: string | null;
};

export async function POST(_: Request, { params }: RouteContext) {
  try {
    const userId = await getAuthenticatedWorkoutUserId();

    if (!userId) {
      return NextResponse.json(
        {
          error: {
            code: "unauthenticated",
            message: "ログインするとセットを追加できます。"
          }
        },
        { status: 401 }
      );
    }

    const supabase = createWorkoutQueryClient();

    let workoutSessionExercise;
    try {
      workoutSessionExercise = await findOwnedWorkoutSessionExercise(
        supabase,
        params.id,
        userId
      );
    } catch {
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

    if (!workoutSessionExercise) {
      return NextResponse.json(
        {
          error: {
            code: "session_exercise_not_found",
            message: "Workout session exercise was not found."
          }
        },
        { status: 404 }
      );
    }

    if (workoutSessionExercise.session.status === "completed") {
      return NextResponse.json(
        {
          error: {
            code: "session_completed",
            message: "Cannot add a set to a completed session."
          }
        },
        { status: 409 }
      );
    }

    const { data: existingSets, error: existingSetsError } = await supabase
      .from("workout_sets")
      .select("set_number, target_reps_text, deleted_at")
      .eq("workout_session_exercise_id", workoutSessionExercise.id)
      .order("set_number", { ascending: false });

    if (existingSetsError) {
      return NextResponse.json(
        {
          error: {
            code: "existing_sets_lookup_failed",
            message: "Existing workout sets lookup failed."
          }
        },
        { status: 500 }
      );
    }

    const normalizedExistingSets = (existingSets ?? []) as ExistingWorkoutSetRow[];
    const nextSetNumber = (normalizedExistingSets[0]?.set_number ?? 0) + 1;
    const previousVisibleSet = normalizedExistingSets.find(
      (set) => set.deleted_at === null
    );
    const targetRepsText = previousVisibleSet?.target_reps_text ?? null;

    const { data: insertedSet, error: insertError } = await supabase
      .from("workout_sets")
      .insert({
        workout_session_exercise_id: workoutSessionExercise.id,
        set_number: nextSetNumber,
        target_reps_text: targetRepsText,
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
      .maybeSingle<InsertedWorkoutSetRow>();

    if (insertError || !insertedSet) {
      return NextResponse.json(
        {
          error: {
            code: "set_insert_failed",
            message: "Failed to add workout set."
          }
        },
        { status: 500 }
      );
    }

    revalidatePath("/train");

    return NextResponse.json({
      id: insertedSet.id,
      workoutSessionExerciseId: insertedSet.workout_session_exercise_id,
      setNumber: insertedSet.set_number,
      targetRepsText: insertedSet.target_reps_text,
      weightKg: insertedSet.weight_kg === null ? null : Number(insertedSet.weight_kg),
      repsDone: insertedSet.reps_done,
      isCompleted: insertedSet.is_completed,
      isLocked: insertedSet.is_locked,
      completedAt: insertedSet.completed_at,
      isAutoFilled: insertedSet.is_auto_filled,
      previousDisplay: "-",
      deletedAt: insertedSet.deleted_at
    });
  } catch (error) {
    console.error("Failed to add workout set.", error);

    return NextResponse.json(
      {
        error: {
          code: "set_insert_unexpected_error",
          message: "Unexpected error occurred while adding the workout set."
        }
      },
      { status: 500 }
    );
  }
}

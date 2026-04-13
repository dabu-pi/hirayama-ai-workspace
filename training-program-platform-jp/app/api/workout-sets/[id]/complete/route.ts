import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  createWorkoutQueryClient,
  findOwnedWorkoutSet,
  getAuthenticatedWorkoutUserId
} from "@/lib/workout/session-access";

type RouteContext = {
  params: {
    id: string;
  };
};

type WorkoutSetMutationRow = {
  id: string;
  is_completed: boolean;
  is_locked: boolean;
  completed_at: string | null;
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
            message: "ログインするとセット完了を記録できます。"
          }
        },
        { status: 401 }
      );
    }

    const supabase = createWorkoutQueryClient();

    let targetSet;
    try {
      targetSet = await findOwnedWorkoutSet(supabase, params.id, userId);
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "complete_lookup_failed",
            message: "Complete target lookup failed."
          }
        },
        { status: 500 }
      );
    }

    if (!targetSet) {
      return NextResponse.json(
        {
          error: {
            code: "set_not_found",
            message: "Workout set was not found."
          }
        },
        { status: 404 }
      );
    }

    if (targetSet.sessionExercise.session.status === "completed") {
      return NextResponse.json(
        {
          error: {
            code: "session_completed",
            message: "Completed sessions cannot be edited."
          }
        },
        { status: 409 }
      );
    }

    if (targetSet.deleted_at) {
      return NextResponse.json(
        {
          error: {
            code: "set_deleted",
            message: "Deleted workout set cannot be completed."
          }
        },
        { status: 409 }
      );
    }

    if (targetSet.is_completed && targetSet.is_locked) {
      return NextResponse.json({
        id: targetSet.id,
        isCompleted: true,
        isLocked: true,
        completedAt: targetSet.completed_at
      });
    }

    const completedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("workout_sets")
      .update({
        is_completed: true,
        is_locked: true,
        completed_at: completedAt
      })
      .eq("id", targetSet.id)
      .is("deleted_at", null);

    if (updateError) {
      return NextResponse.json(
        {
          error: {
            code: "complete_update_failed",
            message: "Failed to complete the workout set."
          }
        },
        { status: 500 }
      );
    }

    revalidatePath("/train");

    return NextResponse.json({
      id: targetSet.id,
      isCompleted: true,
      isLocked: true,
      completedAt
    });
  } catch (error) {
    console.error("Failed to complete workout set.", error);

    return NextResponse.json(
      {
        error: {
          code: "complete_unexpected_error",
          message: "Unexpected error occurred while completing the workout set."
        }
      },
      { status: 500 }
    );
  }
}

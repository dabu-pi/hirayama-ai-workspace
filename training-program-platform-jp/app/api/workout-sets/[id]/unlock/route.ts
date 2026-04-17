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

export async function POST(_: Request, { params }: RouteContext) {
  try {
    const userId = await getAuthenticatedWorkoutUserId();

    if (!userId) {
      return NextResponse.json(
        {
          error: {
            code: "unauthenticated",
            message: "ログインするとセットを解除できます。"
          }
        },
        { status: 401 }
      );
    }

    const supabase = createWorkoutQueryClient();

    let targetSet;
    try {
      targetSet = await findOwnedWorkoutSet(supabase, params.id, userId);
    } catch (lookupError) {
      console.error("Failed to resolve workout set before unlock.", {
        setId: params.id,
        userId,
        lookupError
      });
      return NextResponse.json(
        {
          error: {
            code: "unlock_lookup_failed",
            message: "Unlock target lookup failed."
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
            message: "Deleted workout set cannot be unlocked."
          }
        },
        { status: 409 }
      );
    }

    if (!targetSet.is_completed && !targetSet.is_locked) {
      return NextResponse.json({
        id: targetSet.id,
        isCompleted: false,
        isLocked: false,
        completedAt: null
      });
    }

    const { error: updateError } = await supabase
      .from("workout_sets")
      .update({
        is_completed: false,
        is_locked: false,
        completed_at: null
      })
      .eq("id", targetSet.id)
      .is("deleted_at", null);

    if (updateError) {
      return NextResponse.json(
        {
          error: {
            code: "unlock_update_failed",
            message: "Failed to unlock the workout set."
          }
        },
        { status: 500 }
      );
    }

    revalidatePath("/train");

    return NextResponse.json({
      id: targetSet.id,
      isCompleted: false,
      isLocked: false,
      completedAt: null
    });
  } catch (error) {
    console.error("Failed to unlock workout set.", error);

    return NextResponse.json(
      {
        error: {
          code: "unlock_unexpected_error",
          message: "Unexpected error occurred while unlocking the workout set."
        }
      },
      { status: 500 }
    );
  }
}

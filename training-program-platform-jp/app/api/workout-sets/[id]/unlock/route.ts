import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  findOwnedWorkoutSet,
  getAuthenticatedWorkoutContext
} from "@/lib/workout/session-access";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(_: Request, { params }: RouteContext) {
  try {
    const routeName = "workout-set-unlock";
    const { client: supabase, userId } = await getAuthenticatedWorkoutContext();

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
    console.info(`${routeName}:start`, { setId: params.id, userId });

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
    console.info(`${routeName}:lookup`, {
      setId: params.id,
      userId,
      found: Boolean(targetSet),
      sessionStatus: targetSet?.sessionExercise.session.status ?? null,
      deletedAt: targetSet?.deleted_at ?? null,
      isCompleted: targetSet?.is_completed ?? null
    });

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

    const { data: updatedSet, error: updateError } = await supabase
      .from("workout_sets")
      .update({
        is_completed: false,
        is_locked: false,
        completed_at: null
      })
      .eq("id", targetSet.id)
      .is("deleted_at", null)
      .select("id, is_completed, is_locked, completed_at, deleted_at")
      .maybeSingle<{
        id: string;
        is_completed: boolean;
        is_locked: boolean;
        completed_at: string | null;
        deleted_at: string | null;
      }>();

    if (updateError) {
      console.error(`${routeName}:update_error`, {
        setId: targetSet.id,
        userId,
        updateError
      });
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
    if (!updatedSet) {
      console.warn(`${routeName}:update_conflict`, {
        setId: targetSet.id,
        userId
      });
      return NextResponse.json(
        {
          error: {
            code: "unlock_update_conflict",
            message: "Workout set could not be unlocked."
          }
        },
        { status: 409 }
      );
    }
    console.info(`${routeName}:update_success`, {
      setId: updatedSet.id,
      userId,
      isCompleted: updatedSet.is_completed,
      isLocked: updatedSet.is_locked
    });

    revalidatePath("/train");

    return NextResponse.json({
      id: updatedSet.id,
      isCompleted: updatedSet.is_completed,
      isLocked: updatedSet.is_locked,
      completedAt: updatedSet.completed_at
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

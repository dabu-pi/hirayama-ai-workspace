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
            message: "ログインするとセットを削除できます。"
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
            code: "delete_lookup_failed",
            message: "Delete target lookup failed."
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
            code: "set_already_deleted",
            message: "Workout set has already been deleted."
          }
        },
        { status: 409 }
      );
    }

    if (targetSet.is_locked) {
      return NextResponse.json(
        {
          error: {
            code: "set_locked",
            message: "Locked set cannot be deleted. Unlock it first."
          }
        },
        { status: 409 }
      );
    }

    const deletedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("workout_sets")
      .update({ deleted_at: deletedAt })
      .eq("id", targetSet.id)
      .is("deleted_at", null);

    if (updateError) {
      return NextResponse.json(
        {
          error: {
            code: "delete_update_failed",
            message: "Failed to logical-delete the workout set."
          }
        },
        { status: 500 }
      );
    }

    revalidatePath("/train");

    return NextResponse.json({
      id: targetSet.id,
      deletedAt
    });
  } catch (error) {
    console.error("Failed to delete workout set.", error);

    return NextResponse.json(
      {
        error: {
          code: "delete_unexpected_error",
          message: "Unexpected error occurred while deleting the workout set."
        }
      },
      { status: 500 }
    );
  }
}

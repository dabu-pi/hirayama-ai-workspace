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
    const routeName = "workout-set-delete";
    const { client: supabase, userId } = await getAuthenticatedWorkoutContext();

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

    let targetSet;
    try {
      targetSet = await findOwnedWorkoutSet(supabase, params.id, userId);
    } catch (lookupError) {
      console.error(`${routeName}:lookup_error`, {
        setId: params.id,
        userId,
        lookupError
      });
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

    if (targetSet.sessionExercise.session.status !== "in_progress") {
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

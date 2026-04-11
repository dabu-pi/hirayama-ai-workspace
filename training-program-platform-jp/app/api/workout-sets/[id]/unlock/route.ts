import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasSupabaseServiceRoleEnv
} from "@/lib/supabase/server";

type RouteContext = {
  params: {
    id: string;
  };
};

type WorkoutSetMutationRow = {
  id: string;
  is_completed: boolean;
  is_locked: boolean;
  deleted_at: string | null;
};

export async function POST(_: Request, { params }: RouteContext) {
  try {
    const supabase = hasSupabaseServiceRoleEnv()
      ? createSupabaseAdminClient()
      : createSupabaseServerClient();

    const { data: targetSet, error: selectError } = await supabase
      .from("workout_sets")
      .select("id, is_completed, is_locked, deleted_at")
      .eq("id", params.id)
      .maybeSingle<WorkoutSetMutationRow>();

    if (selectError) {
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
        // When unlock cancels the completion state, MVP should also clear the completion timestamp.
        completed_at: null
      })
      .eq("id", params.id)
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
      id: params.id,
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

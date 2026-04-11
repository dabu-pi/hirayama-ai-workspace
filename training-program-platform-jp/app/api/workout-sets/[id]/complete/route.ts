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
  completed_at: string | null;
  deleted_at: string | null;
};

export async function POST(_: Request, { params }: RouteContext) {
  try {
    const supabase = hasSupabaseServiceRoleEnv()
      ? createSupabaseAdminClient()
      : createSupabaseServerClient();

    const { data: targetSet, error: selectError } = await supabase
      .from("workout_sets")
      .select("id, is_completed, is_locked, completed_at, deleted_at")
      .eq("id", params.id)
      .maybeSingle<WorkoutSetMutationRow>();

    if (selectError) {
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
      .eq("id", params.id)
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
      id: params.id,
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

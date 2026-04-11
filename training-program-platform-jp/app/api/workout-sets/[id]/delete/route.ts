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

export async function POST(_: Request, { params }: RouteContext) {
  try {
    const supabase = hasSupabaseServiceRoleEnv()
      ? createSupabaseAdminClient()
      : createSupabaseServerClient();

    const { data: targetSet, error: selectError } = await supabase
      .from("workout_sets")
      .select("id, is_locked, deleted_at")
      .eq("id", params.id)
      .maybeSingle<{
        id: string;
        is_locked: boolean;
        deleted_at: string | null;
      }>();

    if (selectError) {
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
      .eq("id", params.id)
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
      id: params.id,
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

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

type WorkoutSetPatchRow = {
  id: string;
  weight_kg: number | string | null;
  reps_done: number | null;
  is_auto_filled: boolean;
  is_locked: boolean;
  is_completed: boolean;
  completed_at: string | null;
  deleted_at: string | null;
};

type PatchBody = {
  weightKg?: unknown;
  repsDone?: unknown;
  isAutoFilled?: unknown;
};

function parseNullableWeightKg(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() === "") return null;

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  throw new Error("Kg must be a valid number or blank.");
}

function parseNullableReps(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isInteger(parsed)) {
    throw new Error("Reps must be an integer or blank.");
  }

  return parsed;
}

function parseIsAutoFilled(value: unknown) {
  if (value === undefined) return false;
  if (typeof value === "boolean") return value;

  throw new Error("isAutoFilled must be a boolean.");
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as PatchBody;
    const weightKg = parseNullableWeightKg(body.weightKg);
    const repsDone = parseNullableReps(body.repsDone);
    const isAutoFilled = parseIsAutoFilled(body.isAutoFilled);

    const userId = await getAuthenticatedWorkoutUserId();

    if (!userId) {
      return NextResponse.json(
        {
          error: {
            code: "unauthenticated",
            message: "ログインするとセットを編集できます。"
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
            code: "set_lookup_failed",
            message: "Workout set lookup failed."
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
            message: "Deleted workout set cannot be updated."
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
            message: "Locked workout set cannot be edited. Unlock it first."
          }
        },
        { status: 409 }
      );
    }

    const { data: updatedSet, error: updateError } = await supabase
      .from("workout_sets")
      .update({
        weight_kg: weightKg,
        reps_done: repsDone,
        is_auto_filled: isAutoFilled
      })
      .eq("id", targetSet.id)
      .is("deleted_at", null)
      .eq("is_locked", false)
      .select(
        "id, weight_kg, reps_done, is_auto_filled, is_locked, is_completed, completed_at, deleted_at"
      )
      .maybeSingle<WorkoutSetPatchRow>();

    if (updateError) {
      return NextResponse.json(
        {
          error: {
            code: "set_update_failed",
            message: "Failed to save workout set input."
          }
        },
        { status: 500 }
      );
    }

    if (!updatedSet) {
      return NextResponse.json(
        {
          error: {
            code: "set_update_conflict",
            message: "Workout set could not be updated."
          }
        },
        { status: 409 }
      );
    }

    revalidatePath("/train");

    return NextResponse.json({
      id: updatedSet.id,
      weightKg:
        updatedSet.weight_kg === null ? null : Number(updatedSet.weight_kg),
      repsDone: updatedSet.reps_done,
      isAutoFilled: updatedSet.is_auto_filled,
      isLocked: updatedSet.is_locked,
      isCompleted: updatedSet.is_completed,
      completedAt: updatedSet.completed_at,
      deletedAt: updatedSet.deleted_at
    });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof Error) {
      const message =
        error instanceof SyntaxError
          ? "PATCH body must be valid JSON."
          : error.message;

      if (
        message === "Kg must be a valid number or blank." ||
        message === "Reps must be an integer or blank." ||
        message === "isAutoFilled must be a boolean."
      ) {
        return NextResponse.json(
          {
            error: {
              code: "invalid_input",
              message
            }
          },
          { status: 400 }
        );
      }
    }

    console.error("Failed to patch workout set.", error);

    return NextResponse.json(
      {
        error: {
          code: "set_unexpected_error",
          message: "Unexpected error occurred while saving workout input."
        }
      },
      { status: 500 }
    );
  }
}

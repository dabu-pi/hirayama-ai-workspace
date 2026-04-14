import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { restartProgramEnrollment } from "@/lib/workout/restart-program";
import { getAuthenticatedWorkoutUserId } from "@/lib/workout/session-access";
import type { RestartProgramResponse } from "@/types/workout";

type RouteContext = {
  params: {
    programId: string;
  };
};

/**
 * S-7: POST /api/programs/[programId]/restart
 *
 * Creates a new active enrollment for the signed-in user, pointing at Week 1 /
 * Day 1 of the program. Existing completed enrollments are left in place as
 * history.
 *
 * Idempotent: if an active enrollment for the same (userId, programId) already
 * exists, that one is returned instead of inserting a duplicate.
 *
 * Designed to be called from the Workout Summary "Restart Program" CTA when
 * isProgramCompleted = true.
 */
export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const userId = await getAuthenticatedWorkoutUserId();

    if (!userId) {
      return NextResponse.json(
        {
          error: {
            code: "unauthenticated",
            message: "ログインが必要です。"
          }
        },
        { status: 401 }
      );
    }

    const programId = params.programId;

    if (!programId || typeof programId !== "string") {
      return NextResponse.json(
        {
          error: {
            code: "invalid_request",
            message: "programId is required."
          }
        },
        { status: 400 }
      );
    }

    const result = await restartProgramEnrollment(programId, userId);

    if (!result.ok) {
      if (result.reason === "supabase_unavailable") {
        return NextResponse.json(
          {
            error: {
              code: "supabase_unavailable",
              message: "Supabase is not configured."
            }
          },
          { status: 503 }
        );
      }

      if (result.reason === "program_not_found") {
        return NextResponse.json(
          {
            error: {
              code: "program_not_found",
              message: "Program not found."
            }
          },
          { status: 404 }
        );
      }

      if (result.reason === "first_day_not_found") {
        return NextResponse.json(
          {
            error: {
              code: "first_day_not_found",
              message:
                "このプログラムには Week 1 / Day 1 が見つからず、最初からやり直すことができません。"
            }
          },
          { status: 422 }
        );
      }

      return NextResponse.json(
        {
          error: {
            code: "restart_failed",
            message: "Failed to restart program."
          }
        },
        { status: 500 }
      );
    }

    // Home active-program card reads enrollments with status='active';
    // revalidate so the new enrollment appears immediately.
    revalidatePath("/");

    const body: RestartProgramResponse = {
      enrollmentId: result.enrollmentId,
      programDayId: result.programDayId,
      reused: result.reused,
      redirectUrl: "/"
    };

    return NextResponse.json(body, { status: result.reused ? 200 : 201 });
  } catch (error) {
    console.error("POST /api/programs/[programId]/restart unexpected error.", error);

    return NextResponse.json(
      {
        error: {
          code: "unexpected_error",
          message: "Unexpected error occurred while restarting program."
        }
      },
      { status: 500 }
    );
  }
}

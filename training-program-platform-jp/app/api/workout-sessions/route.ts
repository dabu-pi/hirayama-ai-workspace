import { NextResponse } from "next/server";

import { startSessionForDay } from "@/lib/workout/start-session";

export async function GET() {
  return NextResponse.json({ items: [] });
}

type StartSessionRequestBody = {
  program_day_id?: string;
};

/**
 * POST /api/workout-sessions
 *
 * Body: { program_day_id: string }
 *
 * Creates a new in_progress workout session for the given program_day.
 * Seeds workout_session_exercises and workout_sets from program_day_exercises.
 * Returns { sessionId } on success.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as StartSessionRequestBody;
    const programDayId = body.program_day_id;

    if (!programDayId || typeof programDayId !== "string") {
      return NextResponse.json(
        {
          error: {
            code: "invalid_request",
            message: "program_day_id is required."
          }
        },
        { status: 400 }
      );
    }

    const result = await startSessionForDay(programDayId);

    if (!result.ok) {
      if (result.reason === "supabase_unavailable") {
        return NextResponse.json(
          {
            error: {
              code: "supabase_unavailable",
              message: "Supabase is not configured. Cannot create a real session."
            }
          },
          { status: 503 }
        );
      }

      if (result.reason === "day_not_found") {
        return NextResponse.json(
          {
            error: {
              code: "day_not_found",
              message: "Program day not found."
            }
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: {
            code: "insert_failed",
            message: "Failed to create workout session."
          }
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ sessionId: result.sessionId }, { status: 201 });
  } catch (error) {
    console.error("POST /api/workout-sessions unexpected error.", error);
    return NextResponse.json(
      {
        error: {
          code: "unexpected_error",
          message: "Unexpected error while creating workout session."
        }
      },
      { status: 500 }
    );
  }
}

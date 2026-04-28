import { NextResponse } from "next/server";

import { getDaySessionData } from "@/lib/workout/session-list";

/**
 * GET /api/session-history/day?date=YYYY-MM-DD
 *
 * Returns completed sessions for the given JST date.
 * Response: { sessions: WorkoutSessionListItem[], errorMessage: string | null }
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { sessions: [], errorMessage: "Invalid date format. Use YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const result = await getDaySessionData(date);
  return NextResponse.json(result);
}

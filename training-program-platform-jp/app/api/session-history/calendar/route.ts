import { NextResponse } from "next/server";

import { getCalendarMonthData } from "@/lib/workout/session-list";

/**
 * GET /api/session-history/calendar?year=2026&month=3
 *
 * month is 0-indexed (0 = January), matching JS Date.getMonth().
 * Returns CalendarMonthResult: { entries: CalendarDayEntry[], errorMessage: string | null }
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? "", 10);
  const month = parseInt(searchParams.get("month") ?? "", 10);

  if (isNaN(year) || isNaN(month) || month < 0 || month > 11 || year < 2000 || year > 2100) {
    return NextResponse.json(
      { entries: [], errorMessage: "Invalid year or month parameter." },
      { status: 400 }
    );
  }

  const result = await getCalendarMonthData(year, month);
  return NextResponse.json(result);
}

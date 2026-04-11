import { NextResponse } from "next/server";

import {
  getMockWorkoutSession,
  getMockWorkoutSessions
} from "@/lib/mock/workout";

export async function GET() {
  return NextResponse.json({
    items: getMockWorkoutSessions()
  });
}

export async function POST() {
  return NextResponse.json(getMockWorkoutSession(), { status: 201 });
}

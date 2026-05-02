import { NextResponse } from "next/server";

import { getMockWorkoutSession } from "@/lib/mock/workout";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_: Request, { params }: RouteContext) {
  return NextResponse.json(getMockWorkoutSession(params.id));
}

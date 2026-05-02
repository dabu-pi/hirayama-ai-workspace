import { NextResponse } from "next/server";

import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv
} from "@/lib/supabase/server";
import { getAuthenticatedWorkoutContext } from "@/lib/workout/session-access";

/**
 * POST /api/workout-sessions/custom
 *
 * Creates a program-independent (custom) workout session.
 * program_day_id and program_enrollment_id are both NULL.
 *
 * Idempotency: if an in-progress session already exists for the user,
 * returns its id with status 200 instead of creating a new one.
 *
 * After creation, the client should navigate to /train to load the session.
 */
export async function POST(_request: Request) {
  try {
    const { client: authClient, userId } = await getAuthenticatedWorkoutContext();

    if (!userId) {
      return NextResponse.json(
        { error: { code: "unauthenticated", message: "ログインが必要です。" } },
        { status: 401 }
      );
    }

    const usingAdmin = hasSupabaseServiceRoleEnv();
    const dbClient = usingAdmin ? createSupabaseAdminClient() : authClient;

    // Idempotency: return existing in-progress session if one exists.
    const { data: existing } = await dbClient
      .from("workout_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "in_progress")
      .is("archived_at", null)
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (existing) {
      return NextResponse.json({ sessionId: existing.id }, { status: 200 });
    }

    const { data: inserted, error: insertError } = await dbClient
      .from("workout_sessions")
      .insert({
        user_id: userId,
        status: "in_progress",
        program_day_id: null,
        program_enrollment_id: null,
        started_at: new Date().toISOString()
      })
      .select("id")
      .single<{ id: string }>();

    if (insertError || !inserted) {
      console.error("custom-session-create:insert_failed", {
        userId,
        error: insertError?.message
      });
      return NextResponse.json(
        { error: { code: "session_create_failed", message: "ワークアウトセッションの作成に失敗しました。" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ sessionId: inserted.id }, { status: 201 });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("custom-session-create:unexpected_error", { message: err.message });
    return NextResponse.json(
      { error: { code: "unexpected_error", message: "Unexpected error occurred." } },
      { status: 500 }
    );
  }
}

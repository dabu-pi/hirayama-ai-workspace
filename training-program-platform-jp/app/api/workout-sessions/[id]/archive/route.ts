import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv
} from "@/lib/supabase/server";
import {
  getAuthenticatedWorkoutContext,
  isLikelyUuid
} from "@/lib/workout/session-access";

type RouteContext = {
  params: {
    id: string;
  };
};

type SessionRow = {
  id: string;
  user_id: string;
  status: string;
  archived_at: string | null;
};

/**
 * POST /api/workout-sessions/[id]/archive
 *
 * Soft-archives a session — sets archived_at = now().
 * Archived sessions are excluded from session-history and
 * in-progress blocking checks.
 *
 * Idempotency: already-archived sessions return 200 no-op.
 * Any status (in_progress / completed / cancelled) may be archived.
 * In-progress sessions that are archived no longer block new sessions
 * in the same enrollment (train-entry filters archived_at IS NULL).
 */
export async function POST(_request: Request, { params }: RouteContext) {
  if (!isLikelyUuid(params.id)) {
    return NextResponse.json(
      { error: { code: "invalid_session_id_format", message: "Session id must be a UUID." } },
      { status: 400 }
    );
  }

  try {
    const { client: authClient, userId } = await getAuthenticatedWorkoutContext();

    if (!userId) {
      return NextResponse.json(
        { error: { code: "unauthenticated", message: "ログインが必要です。" } },
        { status: 401 }
      );
    }

    const dbClient = hasSupabaseServiceRoleEnv()
      ? createSupabaseAdminClient()
      : authClient;

    // Verify ownership
    const { data: session, error: lookupError } = await dbClient
      .from("workout_sessions")
      .select("id, user_id, status, archived_at")
      .eq("id", params.id)
      .eq("user_id", userId)
      .maybeSingle<SessionRow>();

    if (lookupError) {
      return NextResponse.json(
        { error: { code: "session_lookup_failed", message: "Session lookup failed." } },
        { status: 500 }
      );
    }

    if (!session) {
      return NextResponse.json(
        { error: { code: "session_not_found", message: "Workout session was not found." } },
        { status: 404 }
      );
    }

    // Idempotent — already archived
    if (session.archived_at !== null) {
      return NextResponse.json({ id: session.id, archived: true, noOp: true });
    }

    const { error: updateError } = await dbClient
      .from("workout_sessions")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", params.id)
      .eq("user_id", userId);

    if (updateError) {
      return NextResponse.json(
        { error: { code: "archive_failed", message: "Failed to archive session." } },
        { status: 500 }
      );
    }

    revalidatePath("/session-history");
    revalidatePath("/");
    revalidatePath("/train"); // archived in-progress session no longer blocks train entry

    return NextResponse.json({ id: params.id, archived: true, noOp: false });
  } catch (error) {
    console.error("Failed to archive workout session.", error);
    return NextResponse.json(
      { error: { code: "archive_unexpected_error", message: "Unexpected error." } },
      { status: 500 }
    );
  }
}

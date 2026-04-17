import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createSupabaseServerClient,
  createSupabaseTokenClient
} from "@/lib/supabase/server";
import type { WorkoutSessionStatus } from "@/types/workout";

type DatabaseClient = SupabaseClient;

export type AuthenticatedWorkoutContext = {
  client: DatabaseClient;
  userId: string | null;
  /**
   * Which auth path produced `client`:
   *   - "token": token client built from auth.getSession().access_token (preferred)
   *   - "cookie": cookie-based server client (fallback — no fresh access token)
   *   - "unauthenticated": auth.getUser() returned null or failed
   */
  authSource: "token" | "cookie" | "unauthenticated";
};

/**
 * Shape used to pass per-query context into findOwnedWorkoutSession for
 * structured logs in Vercel runtime.
 */
export type QueryDiagnosticContext = {
  /** Short identifier of *why* this query is being run (e.g. "cancelLookup"). */
  queryName: string;
  /** Route emitting the query (e.g. "workout-session-cancel"). */
  route?: string;
  /** Auth source from getAuthenticatedWorkoutContext. */
  authSource?: AuthenticatedWorkoutContext["authSource"];
};

/**
 * Very permissive UUID v1–v5 shape check. This is only a client-side guard to
 * short-circuit obvious mock IDs (e.g. "session-demo-20260411") before they
 * reach PostgREST, where they cause 400 22P02 errors that are hard to correlate.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isLikelyUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Classifies a Supabase/PostgREST error into one of our stable cause buckets.
 * Used so log readers can grep for `cause=query_bad_request` regardless of
 * the underlying PostgREST error code.
 */
export type WorkoutQueryFailureCause =
  | "auth_failed"
  | "query_bad_request"
  | "permission_denied"
  | "unknown";

export function classifySupabaseQueryError(
  pgErr: Record<string, unknown> | null | undefined
): WorkoutQueryFailureCause {
  if (!pgErr) return "unknown";
  const code = typeof pgErr.code === "string" ? pgErr.code : "";
  const status =
    typeof pgErr.status === "number"
      ? pgErr.status
      : typeof pgErr.statusCode === "number"
        ? (pgErr.statusCode as number)
        : 0;

  // PostgREST / Supabase auth errors
  if (code === "PGRST301" || status === 401) return "auth_failed";
  // Postgres: invalid_text_representation (bad UUID, bad enum, etc.) + a few
  // other client-side shape errors that PostgREST surfaces as 400.
  if (code === "22P02" || code === "22023" || code === "42703") {
    return "query_bad_request";
  }
  if (status === 400) return "query_bad_request";
  // Row-level security / privilege
  if (code === "42501" || status === 403) return "permission_denied";
  return "unknown";
}

export type OwnedWorkoutSession = {
  id: string;
  user_id: string;
  status: WorkoutSessionStatus;
  finished_at: string | null;
  program_day_id: string | null;
  program_enrollment_id: string | null;
};

export type OwnedWorkoutSessionExercise = {
  id: string;
  workout_session_id: string;
  session: OwnedWorkoutSession;
};

export type OwnedWorkoutSet = {
  id: string;
  workout_session_exercise_id: string;
  set_number: number;
  target_reps_text: string | null;
  weight_kg: number | string | null;
  reps_done: number | null;
  is_auto_filled: boolean;
  is_locked: boolean;
  is_completed: boolean;
  completed_at: string | null;
  deleted_at: string | null;
  sessionExercise: OwnedWorkoutSessionExercise;
};

type SessionExerciseRow = Omit<OwnedWorkoutSessionExercise, "session">;
type WorkoutSetRow = Omit<OwnedWorkoutSet, "sessionExercise">;

// Always use server client so that RLS policies apply correctly.
// Admin client (service role) bypasses RLS and must not be used for
// user-scoped queries.
export function createWorkoutQueryClient(): DatabaseClient {
  return createSupabaseServerClient();
}

export async function getAuthenticatedWorkoutContext(): Promise<AuthenticatedWorkoutContext> {
  // cookieClient is used only for auth.getUser() — it reads the session from cookies.
  const cookieClient = createWorkoutQueryClient();
  const { data, error } = await cookieClient.auth.getUser();

  if (error) {
    // auth.getUser() errors (expired token, missing session, network) mean the user
    // is not authenticated — return null userId so routes return 401 rather than 500.
    console.warn("getAuthenticatedWorkoutContext: auth.getUser() failed — treating as unauthenticated", {
      name: error.name,
      message: error.message
    });
    return { client: cookieClient, userId: null, authSource: "unauthenticated" };
  }

  if (!data.user) {
    return { client: cookieClient, userId: null, authSource: "unauthenticated" };
  }

  // After auth.getUser() (which may have refreshed the token internally), read the
  // in-memory session to get the current access token.  Then build an explicit-token
  // client for all DB queries: this passes the token directly in the Authorization
  // header instead of re-reading from cookies, which avoids the race where PostgREST
  // receives a stale/expired cookie token even after a successful auth.getUser().
  const { data: sessionData } = await cookieClient.auth.getSession();
  const hasAccessToken = Boolean(sessionData.session?.access_token);
  const dbClient = hasAccessToken
    ? createSupabaseTokenClient(sessionData.session!.access_token)
    : cookieClient;

  return {
    client: dbClient,
    userId: data.user.id,
    authSource: hasAccessToken ? "token" : "cookie"
  };
}

export async function getAuthenticatedWorkoutUserId() {
  const { userId } = await getAuthenticatedWorkoutContext();
  return userId;
}

export async function findOwnedWorkoutSession(
  client: DatabaseClient,
  sessionId: string,
  userId: string,
  diagnostic?: QueryDiagnosticContext
): Promise<OwnedWorkoutSession | null> {
  const queryName = diagnostic?.queryName ?? "findOwnedWorkoutSession";
  const route = diagnostic?.route ?? "unknown";
  const authSource = diagnostic?.authSource ?? "unknown";

  // Structured log prior to the PostgREST call — lets us correlate the eventual
  // 400 to a specific query identifier in Vercel runtime logs.
  console.info("workout-query:start", {
    route,
    queryName,
    table: "workout_sessions",
    op: "select.maybeSingle",
    select:
      "id, user_id, status, finished_at, program_day_id, program_enrollment_id",
    filters: { id: sessionId, user_id: userId },
    sessionIdIsUuid: isLikelyUuid(sessionId),
    authSource
  });

  // Short-circuit obvious mock / non-UUID session IDs before they reach PostgREST.
  // Without this, PostgREST responds 400 22P02 and the route surfaces as a 500.
  if (!isLikelyUuid(sessionId)) {
    console.warn("workout-query:precheck_failed", {
      route,
      queryName,
      reason: "sessionId is not a valid UUID",
      sessionId,
      userId,
      cause: "query_bad_request" satisfies WorkoutQueryFailureCause
    });
    // Fall through: we still issue the query so behaviour does not change,
    // but the warning flags the likely cause in logs.
  }

  const { data, error } = await client
    .from("workout_sessions")
    .select(
      "id, user_id, status, finished_at, program_day_id, program_enrollment_id"
    )
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle<OwnedWorkoutSession>();

  if (error) {
    const pgErr = error as unknown as Record<string, unknown>;
    const cause = classifySupabaseQueryError(pgErr);
    console.error("workout-query:error", {
      route,
      queryName,
      table: "workout_sessions",
      op: "select.maybeSingle",
      filters: { id: sessionId, user_id: userId },
      sessionIdIsUuid: isLikelyUuid(sessionId),
      authSource,
      cause,
      errorCode: pgErr.code,
      errorStatus: pgErr.status ?? pgErr.statusCode,
      errorMessage: error.message,
      errorHint: pgErr.hint,
      errorDetails: pgErr.details
    });
    throw new Error(`Failed to load owned workout session: ${error.message}`);
  }

  console.info("workout-query:ok", {
    route,
    queryName,
    found: Boolean(data),
    status: data?.status ?? null
  });

  return data;
}

export async function findOwnedWorkoutSessionExercise(
  client: DatabaseClient,
  sessionExerciseId: string,
  userId: string
): Promise<OwnedWorkoutSessionExercise | null> {
  const { data: sessionExercise, error: sessionExerciseError } = await client
    .from("workout_session_exercises")
    .select("id, workout_session_id")
    .eq("id", sessionExerciseId)
    .maybeSingle<SessionExerciseRow>();

  if (sessionExerciseError) {
    throw new Error(
      `Failed to load owned workout session exercise: ${sessionExerciseError.message}`
    );
  }

  if (!sessionExercise) {
    return null;
  }

  const session = await findOwnedWorkoutSession(
    client,
    sessionExercise.workout_session_id,
    userId
  );

  if (!session) {
    return null;
  }

  return {
    ...sessionExercise,
    session
  };
}

export async function findOwnedWorkoutSet(
  client: DatabaseClient,
  setId: string,
  userId: string
): Promise<OwnedWorkoutSet | null> {
  const { data: workoutSet, error: workoutSetError } = await client
    .from("workout_sets")
    .select(
      "id, workout_session_exercise_id, set_number, target_reps_text, weight_kg, reps_done, is_auto_filled, is_locked, is_completed, completed_at, deleted_at"
    )
    .eq("id", setId)
    .maybeSingle<WorkoutSetRow>();

  if (workoutSetError) {
    throw new Error(`Failed to load owned workout set: ${workoutSetError.message}`);
  }

  if (!workoutSet) {
    return null;
  }

  const sessionExercise = await findOwnedWorkoutSessionExercise(
    client,
    workoutSet.workout_session_exercise_id,
    userId
  );

  if (!sessionExercise) {
    return null;
  }

  return {
    ...workoutSet,
    sessionExercise
  };
}

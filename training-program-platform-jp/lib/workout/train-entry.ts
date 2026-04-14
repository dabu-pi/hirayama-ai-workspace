import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";
import { getProgramDayLabel } from "@/lib/workout/start-session";
import type { TrainEntryResolution } from "@/types/workout";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

type ProgramDayRow = {
  id: string;
  program_week_id: string;
};

type ProgramWeekRow = {
  program_id: string;
};

type EnrollmentRow = {
  id: string;
};

type InProgressSessionRow = {
  id: string;
  program_day_id: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function invalidResolution(
  programDayId: string | null,
  reason: string
): TrainEntryResolution {
  return {
    mode: "invalid",
    requestedProgramDayId: programDayId,
    resolvedProgramDayId: null,
    sessionId: null,
    blockedBySessionId: null,
    blockedByProgramDayId: null,
    blockedByDayLabel: null,
    reason,
    incompleteSessionCount: 0
  };
}

/**
 * Resolves program_id from a program_day_id via
 * program_days → program_weeks (2 sequential queries).
 */
async function resolveProgramIdFromDayId(
  programDayId: string,
  client: SupabaseClient
): Promise<string | null> {
  const { data: day, error: dayError } = await client
    .from("program_days")
    .select("id, program_week_id")
    .eq("id", programDayId)
    .maybeSingle<ProgramDayRow>();

  if (dayError || !day) return null;

  const { data: week, error: weekError } = await client
    .from("program_weeks")
    .select("program_id")
    .eq("id", day.program_week_id)
    .maybeSingle<ProgramWeekRow>();

  if (weekError || !week) return null;

  return week.program_id;
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

/**
 * S-3: Determines the correct entry mode for a /train session start.
 *
 * Query budget: 3–5 fixed queries (no N+1).
 *   1. program_days (resolve programId — step 1a)
 *   2. program_weeks (resolve programId — step 1b)
 *   3. program_enrollments (find active enrollment)
 *   4. workout_sessions (find in-progress sessions for enrollment)
 *   5. program_days + program_weeks (day label for blocking session — only if blocked)
 *
 * Resolution logic:
 *   1. No active enrollment found → 'start' (first session, enrollment will be created).
 *   2. In-progress session for the requested day → 'resume'.
 *   3. In-progress session for a DIFFERENT day in same enrollment → 'blocked'.
 *   4. No in-progress sessions → 'start'.
 */
export async function resolveTrainingEntry(
  programDayId: string
): Promise<TrainEntryResolution> {
  if (!hasSupabasePublicEnv()) {
    return invalidResolution(programDayId, "supabase_unavailable");
  }

  const client = createSupabaseServerClient();
  const { data: userData } = await client.auth.getUser();
  const userId = userData?.user?.id ?? null;

  if (!userId) {
    return invalidResolution(programDayId, "unauthenticated");
  }

  // ---- 1. Resolve program_id ----
  const programId = await resolveProgramIdFromDayId(programDayId, client);

  // ---- 2. Find active enrollment ----
  let enrollmentId: string | null = null;

  if (programId) {
    const { data: enrollment } = await client
      .from("program_enrollments")
      .select("id")
      .eq("user_id", userId)
      .eq("program_id", programId)
      .eq("status", "active")
      .maybeSingle<EnrollmentRow>();

    enrollmentId = enrollment?.id ?? null;
  }

  // No enrollment → safe to start (enrollment created on session insert)
  if (!enrollmentId) {
    return {
      mode: "start",
      requestedProgramDayId: programDayId,
      resolvedProgramDayId: programDayId,
      sessionId: null,
      blockedBySessionId: null,
      blockedByProgramDayId: null,
      blockedByDayLabel: null,
      reason: null,
      incompleteSessionCount: 0
    };
  }

  // ---- 3. Check for in-progress sessions in this enrollment ----
  const { data: rawSessions } = await client
    .from("workout_sessions")
    .select("id, program_day_id")
    .eq("program_enrollment_id", enrollmentId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false });

  const sessions = (rawSessions ?? []) as InProgressSessionRow[];

  // No in-progress sessions → safe to start
  if (sessions.length === 0) {
    return {
      mode: "start",
      requestedProgramDayId: programDayId,
      resolvedProgramDayId: programDayId,
      sessionId: null,
      blockedBySessionId: null,
      blockedByProgramDayId: null,
      blockedByDayLabel: null,
      reason: null,
      incompleteSessionCount: 0
    };
  }

  // ---- 4. Check if any in-progress session matches the requested day ----
  const sameDaySession = sessions.find(
    (s) => s.program_day_id === programDayId
  );

  if (sameDaySession) {
    return {
      mode: "resume",
      requestedProgramDayId: programDayId,
      resolvedProgramDayId: programDayId,
      sessionId: sameDaySession.id,
      blockedBySessionId: null,
      blockedByProgramDayId: null,
      blockedByDayLabel: null,
      reason: null,
      incompleteSessionCount: sessions.length
    };
  }

  // ---- 5. Different-day in-progress session → blocked ----
  const blockingSession = sessions[0]; // most recent
  const blockedByProgramDayId = blockingSession.program_day_id;
  const blockedByDayLabel = blockedByProgramDayId
    ? await getProgramDayLabel(blockedByProgramDayId)
    : null;

  return {
    mode: "blocked",
    requestedProgramDayId: programDayId,
    resolvedProgramDayId: null,
    sessionId: null,
    blockedBySessionId: blockingSession.id,
    blockedByProgramDayId,
    blockedByDayLabel,
    reason: "other_day_in_progress",
    incompleteSessionCount: sessions.length
  };
}

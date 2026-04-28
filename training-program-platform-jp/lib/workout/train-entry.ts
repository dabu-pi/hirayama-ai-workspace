import "server-only";

import { hasSupabasePublicEnv } from "@/lib/supabase/server";
import { getAuthenticatedWorkoutContext } from "@/lib/workout/session-access";
import { getProgramDayLabel } from "@/lib/workout/start-session";
import type { TrainEntryResolution } from "@/types/workout";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

/**
 * S-3: Determines the correct entry mode for a /train session start.
 *
 * Query budget: 1 query (+ 1 only when blocked, for day label).
 *   Previously: 4 sequential queries (program_days → program_weeks →
 *   program_enrollments → workout_sessions).
 *
 *   Now: single workout_sessions query scoped to user_id — same global
 *   blocking semantics as startSessionForDay.
 *
 * Resolution logic:
 *   1. No in-progress sessions for user → 'start'.
 *   2. In-progress session for the requested day → 'resume'.
 *   3. In-progress session for a DIFFERENT day → 'blocked'.
 */
export async function resolveTrainingEntry(
  programDayId: string
): Promise<TrainEntryResolution> {
  if (!hasSupabasePublicEnv()) {
    return invalidResolution(programDayId, "supabase_unavailable");
  }

  const { client, userId } = await getAuthenticatedWorkoutContext();

  if (!userId) {
    return invalidResolution(programDayId, "unauthenticated");
  }

  // Single query: any in-progress session for this user (global, not enrollment-scoped).
  // Consistent with startSessionForDay's blocking check.
  const { data: rawSessions } = await client
    .from("workout_sessions")
    .select("id, program_day_id")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .is("archived_at", null)
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

  // In-progress session matches the requested day → resume
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

  // Different-day in-progress session → blocked
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

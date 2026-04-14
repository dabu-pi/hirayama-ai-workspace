import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";
import type {
  ActiveProgramResult,
  ActiveProgramSession,
  ActiveProgramView,
  E1RMTrend,
  VolumeTrend,
  WorkoutSessionStatus
} from "@/types/workout";

type DatabaseClient = SupabaseClient;

const RECENT_SESSION_LIMIT = 3;
/** Number of recent completed sessions used to compute the volume trend. */
const TREND_SESSION_LIMIT = 6;

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

type EnrollmentRow = {
  id: string;
  program_id: string;
  current_program_day_id: string | null;
  status: "active" | "paused" | "completed";
  started_at: string;
  updated_at: string;
};

type ProgramRow = {
  id: string;
  slug: string;
  title: string;
  level: string | null;
  days_per_week: number;
  duration_weeks: number;
};

type ProgramDayRow = {
  id: string;
  day_number: number;
  program_week_id: string;
};

// Used for progress-only week lookups (includes program_id for grouping).
type ProgramWeekWithProgramId = {
  id: string;
  week_number: number;
  program_id: string;
};

// Used for label lookups (current week / session weeks).
type ProgramWeekRow = {
  id: string;
  week_number: number;
  label: string | null;
};

type SessionRow = {
  id: string;
  started_at: string;
  status: WorkoutSessionStatus;
  program_day_id: string | null;
  program_enrollment_id: string | null;
};

// S-2: in-progress session row
type InProgressSessionRow = {
  id: string;
  program_enrollment_id: string;
  /** program_day_id of the in-progress session — used to build resume URL */
  program_day_id: string | null;
};

// H-4: trend row types
type TrendSessionRow = {
  id: string;
  program_enrollment_id: string;
  started_at: string;
};

type TrendExerciseRow = {
  id: string;
  workout_session_id: string;
  /** 'T1' | 'T2' | 'T3' — used to identify T1 sets for e1RM calculation */
  exercise_type: string;
  /** UUID of the exercise master record — used to identify the primary T1 lift */
  exercise_id: string;
};

type TrendSetRow = {
  workout_session_exercise_id: string;
  weight_kg: number | null;
  reps_done: number | null;
};

// ---------------------------------------------------------------------------
// Queries — enrollment / programs / weeks / days
// ---------------------------------------------------------------------------

/**
 * Returns all active enrollments for the user, ordered by most-recently-
 * updated first (updated_at desc, created_at desc as fallback).
 */
async function selectActiveEnrollments(
  client: DatabaseClient,
  userId: string
): Promise<EnrollmentRow[]> {
  const { data, error } = await client
    .from("program_enrollments")
    .select("id, program_id, current_program_day_id, status, started_at, updated_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load active enrollments: ${error.message}`);
  }

  return (data ?? []) as EnrollmentRow[];
}

async function selectProgramsBatch(
  client: DatabaseClient,
  programIds: string[]
): Promise<ProgramRow[]> {
  if (programIds.length === 0) return [];

  const { data, error } = await client
    .from("programs")
    .select("id, slug, title, level, days_per_week, duration_weeks")
    .in("id", programIds);

  if (error) return [];
  return (data ?? []) as ProgramRow[];
}

async function selectProgramDaysBatch(
  client: DatabaseClient,
  dayIds: string[]
): Promise<ProgramDayRow[]> {
  if (dayIds.length === 0) return [];

  const { data, error } = await client
    .from("program_days")
    .select("id, day_number, program_week_id")
    .in("id", dayIds);

  if (error) return [];
  return (data ?? []) as ProgramDayRow[];
}

async function selectProgramWeeksBatch(
  client: DatabaseClient,
  weekIds: string[]
): Promise<ProgramWeekRow[]> {
  if (weekIds.length === 0) return [];

  const { data, error } = await client
    .from("program_weeks")
    .select("id, week_number, label")
    .in("id", weekIds);

  if (error) return [];
  return (data ?? []) as ProgramWeekRow[];
}

async function selectAllProgramWeeksByProgramIds(
  client: DatabaseClient,
  programIds: string[]
): Promise<ProgramWeekWithProgramId[]> {
  if (programIds.length === 0) return [];

  const { data, error } = await client
    .from("program_weeks")
    .select("id, week_number, program_id")
    .in("program_id", programIds)
    .order("week_number", { ascending: true });

  if (error) return [];
  return (data ?? []) as ProgramWeekWithProgramId[];
}

async function selectAllProgramDays(
  client: DatabaseClient,
  weekIds: string[]
): Promise<ProgramDayRow[]> {
  if (weekIds.length === 0) return [];

  const { data, error } = await client
    .from("program_days")
    .select("id, day_number, program_week_id")
    .in("program_week_id", weekIds);

  if (error) return [];
  return (data ?? []) as ProgramDayRow[];
}

// ---------------------------------------------------------------------------
// Queries — recent sessions (display)
// ---------------------------------------------------------------------------

/**
 * Fetches recent sessions for display in the card (all statuses).
 * Groups in-memory, up to RECENT_SESSION_LIMIT per enrollment.
 */
async function selectRecentSessionsForEnrollments(
  client: DatabaseClient,
  userId: string,
  enrollmentIds: string[]
): Promise<SessionRow[]> {
  if (enrollmentIds.length === 0) return [];

  const { data, error } = await client
    .from("workout_sessions")
    .select("id, started_at, status, program_day_id, program_enrollment_id")
    .eq("user_id", userId)
    .in("program_enrollment_id", enrollmentIds)
    .order("started_at", { ascending: false })
    .limit(enrollmentIds.length * RECENT_SESSION_LIMIT);

  if (error) return [];
  return (data ?? []) as SessionRow[];
}

// ---------------------------------------------------------------------------
// Queries — in-progress sessions (S-2)
// ---------------------------------------------------------------------------

/**
 * S-2: Batch-fetches in-progress sessions for the given enrollment IDs.
 * Returns at most one row per enrollment in normal usage (二重作成防止).
 * In the abnormal case of multiple in-progress sessions per enrollment,
 * DESC order by started_at ensures the most recent one is processed first.
 */
async function selectInProgressSessionsForEnrollments(
  client: DatabaseClient,
  enrollmentIds: string[]
): Promise<InProgressSessionRow[]> {
  if (enrollmentIds.length === 0) return [];

  const { data, error } = await client
    .from("workout_sessions")
    .select("id, program_enrollment_id, program_day_id")
    .in("program_enrollment_id", enrollmentIds)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as InProgressSessionRow[];
}

// ---------------------------------------------------------------------------
// Queries — trend sessions / exercises / sets (H-4)
// ---------------------------------------------------------------------------

/**
 * H-4: Fetches recent *completed* sessions per enrollment for volume trend.
 * Only status='completed' sessions are used for trend calculation.
 * Returns enough rows to give up to TREND_SESSION_LIMIT per enrollment.
 */
async function selectTrendSessions(
  client: DatabaseClient,
  userId: string,
  enrollmentIds: string[]
): Promise<TrendSessionRow[]> {
  if (enrollmentIds.length === 0) return [];

  const { data, error } = await client
    .from("workout_sessions")
    .select("id, program_enrollment_id, started_at")
    .eq("user_id", userId)
    .in("program_enrollment_id", enrollmentIds)
    .eq("status", "completed")
    .order("started_at", { ascending: false })
    .limit(enrollmentIds.length * TREND_SESSION_LIMIT);

  if (error) return [];
  return (data ?? []) as TrendSessionRow[];
}

/**
 * H-4: Batch-fetches workout_session_exercises for the given session IDs.
 * Used to bridge sessions → sets for volume aggregation.
 */
/**
 * H-4 / H-4b: Batch-fetches workout_session_exercises for the given session IDs.
 * Selects exercise_type and exercise_id to support T1 filtering for e1RM
 * without any additional queries.
 */
async function selectTrendExercises(
  client: DatabaseClient,
  sessionIds: string[]
): Promise<TrendExerciseRow[]> {
  if (sessionIds.length === 0) return [];

  const { data, error } = await client
    .from("workout_session_exercises")
    .select("id, workout_session_id, exercise_type, exercise_id")
    .in("workout_session_id", sessionIds);

  if (error) return [];
  return (data ?? []) as TrendExerciseRow[];
}

/**
 * H-4: Batch-fetches completed, non-deleted sets for the given exercise IDs.
 * Only is_completed=true and deleted_at IS NULL sets are included.
 * Weight-null sets are fetched but excluded from volume in the aggregation step.
 */
async function selectTrendSets(
  client: DatabaseClient,
  exerciseIds: string[]
): Promise<TrendSetRow[]> {
  if (exerciseIds.length === 0) return [];

  const { data, error } = await client
    .from("workout_sets")
    .select("workout_session_exercise_id, weight_kg, reps_done")
    .in("workout_session_exercise_id", exerciseIds)
    .eq("is_completed", true)
    .is("deleted_at", null);

  if (error) return [];
  return (data ?? []) as TrendSetRow[];
}

// ---------------------------------------------------------------------------
// Progress computation
// ---------------------------------------------------------------------------

type ProgressResult = {
  completedDays: number;
  totalDays: number;
  progressPercent: number;
};

/**
 * Computes progress for a single enrollment.
 * current_program_day_id is the *next* day to do; its 0-based index = completedDays.
 * Defensive: returns 0% if totalDays=0 or currentProgramDayId not found in list.
 */
function computeProgress(
  allWeeks: Array<{ id: string; week_number: number }>,
  allDays: ProgramDayRow[],
  currentProgramDayId: string | null
): ProgressResult {
  const weekOrderMap = new Map(allWeeks.map((w) => [w.id, w.week_number]));

  const sortedDays = [...allDays].sort((a, b) => {
    const weekA = weekOrderMap.get(a.program_week_id) ?? 0;
    const weekB = weekOrderMap.get(b.program_week_id) ?? 0;
    if (weekA !== weekB) return weekA - weekB;
    return a.day_number - b.day_number;
  });

  const totalDays = sortedDays.length;

  if (totalDays === 0) {
    return { completedDays: 0, totalDays: 0, progressPercent: 0 };
  }

  const currentIndex = currentProgramDayId
    ? sortedDays.findIndex((d) => d.id === currentProgramDayId)
    : -1;

  const completedDays = currentIndex >= 0 ? currentIndex : 0;
  const progressPercent = Math.round((completedDays / totalDays) * 100);

  return { completedDays, totalDays, progressPercent };
}

// ---------------------------------------------------------------------------
// Volume trend computation (H-4)
// ---------------------------------------------------------------------------

/**
 * Builds a session_id → total volume map.
 *
 * Volume definition:
 *   sum of (weight_kg × reps_done) per completed, non-deleted set.
 *   Sets with null/zero weight or null/zero reps are excluded (bodyweight / incomplete data).
 *   Session volume can be 0 if all sets in that session are bodyweight-only.
 */
function aggregateSessionVolumes(
  trendSessions: TrendSessionRow[],
  trendExercises: TrendExerciseRow[],
  trendSets: TrendSetRow[]
): Map<string, number> {
  // exercise_id → session_id
  const exerciseToSession = new Map<string, string>();
  for (const e of trendExercises) {
    exerciseToSession.set(e.id, e.workout_session_id);
  }

  // Initialize all sessions to 0 (sessions with no qualifying sets get 0)
  const sessionVolume = new Map<string, number>();
  for (const s of trendSessions) {
    sessionVolume.set(s.id, 0);
  }

  for (const set of trendSets) {
    if (set.weight_kg === null || set.weight_kg <= 0) continue;
    if (set.reps_done === null || set.reps_done <= 0) continue;

    const sessionId = exerciseToSession.get(set.workout_session_exercise_id);
    if (!sessionId) continue;
    if (!sessionVolume.has(sessionId)) continue; // safety — shouldn't happen

    sessionVolume.set(sessionId, sessionVolume.get(sessionId)! + set.weight_kg * set.reps_done);
  }

  return sessionVolume;
}

/**
 * Builds the VolumeTrend for one enrollment from pre-aggregated data.
 *
 * - trendSessions must be pre-filtered to status='completed' and sorted DESC.
 * - Takes the top TREND_SESSION_LIMIT for this enrollment, then reverses to
 *   chronological order (oldest → newest) for sparkline display.
 */
function buildVolumeTrend(
  enrollmentId: string,
  trendSessions: TrendSessionRow[],
  sessionVolumeMap: Map<string, number>
): VolumeTrend {
  // Sessions are sorted DESC from DB; take top N for this enrollment, then reverse
  const enrollmentSessions = trendSessions
    .filter((s) => s.program_enrollment_id === enrollmentId)
    .slice(0, TREND_SESSION_LIMIT)
    .reverse(); // oldest → newest (chronological)

  if (enrollmentSessions.length === 0) {
    return {
      recentVolumes: [],
      latestVolume: null,
      previousVolume: null,
      volumeChangePercent: null
    };
  }

  const recentVolumes = enrollmentSessions.map((s) =>
    Math.round(sessionVolumeMap.get(s.id) ?? 0)
  );

  const latestVolume = recentVolumes[recentVolumes.length - 1] ?? null;
  const previousVolume = recentVolumes.length >= 2
    ? (recentVolumes[recentVolumes.length - 2] ?? null)
    : null;

  let volumeChangePercent: number | null = null;
  if (latestVolume !== null && previousVolume !== null && previousVolume > 0) {
    // 1 decimal place, e.g. 11.7
    volumeChangePercent =
      Math.round(((latestVolume - previousVolume) / previousVolume) * 1000) / 10;
  }

  return { recentVolumes, latestVolume, previousVolume, volumeChangePercent };
}

// ---------------------------------------------------------------------------
// E1RM trend computation (H-4b)
// ---------------------------------------------------------------------------

/**
 * Builds the E1RMTrend for one enrollment.
 *
 * T1 judgment:  exercise_type = 'T1' in workout_session_exercises.
 * Primary lift: T1 exercise_id that appears in the most sessions for this enrollment.
 *               Ties are broken by Map insertion order (deterministic per call).
 * Session rep:  max Epley e1RM among all qualifying T1 sets in that session.
 * Epley:        e1RM = weight_kg × (1 + reps_done / 30)
 *
 * Sessions with no qualifying T1 data are excluded from recentE1RMs (not shown
 * in sparkline) but are still counted toward TREND_SESSION_LIMIT.
 *
 * Defensive: returns empty trend if no T1 exercises or no qualifying sets.
 */
function buildE1RMTrend(
  enrollmentId: string,
  trendSessions: TrendSessionRow[],
  trendExercises: TrendExerciseRow[],
  trendSets: TrendSetRow[]
): E1RMTrend {
  const empty: E1RMTrend = {
    recentE1RMs: [],
    latestE1RM: null,
    previousE1RM: null,
    e1rmChangePercent: null
  };

  // Sessions for this enrollment (DESC from DB → take top N → reverse to chronological)
  const enrollmentSessions = trendSessions
    .filter((s) => s.program_enrollment_id === enrollmentId)
    .slice(0, TREND_SESSION_LIMIT)
    .reverse();

  if (enrollmentSessions.length === 0) return empty;

  const enrollmentSessionIds = new Set(enrollmentSessions.map((s) => s.id));

  // T1 session_exercises that belong to this enrollment's sessions
  const t1Exercises = trendExercises.filter(
    (e) => e.exercise_type === "T1" && enrollmentSessionIds.has(e.workout_session_id)
  );

  if (t1Exercises.length === 0) return empty;

  // Find the primary T1 lift: exercise_id present in the most sessions
  const sessionsByExerciseId = new Map<string, Set<string>>();
  for (const e of t1Exercises) {
    const sessions = sessionsByExerciseId.get(e.exercise_id) ?? new Set<string>();
    sessions.add(e.workout_session_id);
    sessionsByExerciseId.set(e.exercise_id, sessions);
  }

  let primaryExerciseId = "";
  let maxCount = 0;
  for (const [exId, sessions] of sessionsByExerciseId) {
    if (sessions.size > maxCount) {
      maxCount = sessions.size;
      primaryExerciseId = exId;
    }
  }

  // session_exercise IDs that belong to the primary T1 lift
  const primaryT1ExIds = new Set(
    t1Exercises.filter((e) => e.exercise_id === primaryExerciseId).map((e) => e.id)
  );

  // exercise UUID → session_id lookup (covers all exercises, not just T1)
  const exerciseToSession = new Map(trendExercises.map((e) => [e.id, e.workout_session_id]));

  // Compute max Epley e1RM per session for the primary T1 lift
  const sessionE1RM = new Map<string, number | null>(
    enrollmentSessions.map((s) => [s.id, null])
  );

  for (const set of trendSets) {
    if (!primaryT1ExIds.has(set.workout_session_exercise_id)) continue;
    if (set.weight_kg === null || set.weight_kg <= 0) continue;
    if (set.reps_done === null || set.reps_done <= 0) continue;

    const sessionId = exerciseToSession.get(set.workout_session_exercise_id);
    if (!sessionId || !enrollmentSessionIds.has(sessionId)) continue;

    const e1rm = set.weight_kg * (1 + set.reps_done / 30); // Epley
    const current = sessionE1RM.get(sessionId) ?? null;
    if (current === null || e1rm > current) {
      sessionE1RM.set(sessionId, e1rm);
    }
  }

  // Build recentE1RMs — only sessions where primary T1 data was found
  const sessionsWithData = enrollmentSessions.filter(
    (s) => (sessionE1RM.get(s.id) ?? null) !== null
  );

  if (sessionsWithData.length === 0) return empty;

  // Round to 1 decimal (e.g. 142.5)
  const recentE1RMs = sessionsWithData.map((s) =>
    Math.round((sessionE1RM.get(s.id) ?? 0) * 10) / 10
  );

  const latestE1RM = recentE1RMs[recentE1RMs.length - 1] ?? null;
  const previousE1RM = recentE1RMs.length >= 2
    ? (recentE1RMs[recentE1RMs.length - 2] ?? null)
    : null;

  let e1rmChangePercent: number | null = null;
  if (latestE1RM !== null && previousE1RM !== null && previousE1RM > 0) {
    e1rmChangePercent =
      Math.round(((latestE1RM - previousE1RM) / previousE1RM) * 1000) / 10;
  }

  return { recentE1RMs, latestE1RM, previousE1RM, e1rmChangePercent };
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatFrequency(daysPerWeek: number): string {
  return `${daysPerWeek} day${daysPerWeek === 1 ? "" : "s"} / week`;
}

function formatDuration(weeks: number): string {
  return `${weeks} week${weeks === 1 ? "" : "s"}`;
}

function buildWeekDayLabel(
  weekNumber: number | null,
  weekLabel: string | null,
  dayNumber: number | null
): string | null {
  const weekPart = weekLabel?.trim() || (weekNumber ? `Week ${weekNumber}` : null);
  const dayPart = dayNumber ? `Day ${dayNumber}` : null;
  const parts = [weekPart, dayPart].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : null;
}

function formatSessionDate(startedAt: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(startedAt)) return startedAt.slice(0, 10);
  const parsed = new Date(startedAt);
  return Number.isNaN(parsed.getTime()) ? startedAt : parsed.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Returns all active program views for the current user.
 *
 * Query budget: 12 queries regardless of enrollment count (N+1 free).
 *   1.     selectActiveEnrollments
 *   2–6.   parallel: programs, currentDays, allWeeks, recentSessions, trendSessions
 *   7–10.  parallel: currentWeeks, allDays, sessionDays, trendExercises
 *   11–12. parallel: sessionWeeks, trendSets
 */
export async function getActiveProgramView(): Promise<ActiveProgramResult> {
  if (!hasSupabasePublicEnv()) {
    return {
      views: [],
      isAuthenticated: false,
      errorMessage: "Supabase is not configured for this environment."
    };
  }

  try {
    const serverClient = createSupabaseServerClient();
    const scopedUser = await serverClient.auth.getUser();
    const userId = scopedUser.data.user?.id ?? null;

    if (!userId) {
      return { views: [], isAuthenticated: false, errorMessage: null };
    }

    const enrollments = await selectActiveEnrollments(serverClient, userId);

    if (enrollments.length === 0) {
      return { views: [], isAuthenticated: true, errorMessage: null };
    }

    const programIds = [...new Set(enrollments.map((e) => e.program_id))];
    const enrollmentIds = enrollments.map((e) => e.id);

    const currentDayIds = enrollments
      .map((e) => e.current_program_day_id)
      .filter((id): id is string => Boolean(id));

    // ── Batch 1: all independent ──────────────────────────────────────────
    // S-2 adds selectInProgressSessionsForEnrollments → total queries: 13 (fixed)
    const [
      programs,
      currentDays,
      allWeeks,
      recentSessions,
      trendSessions,
      inProgressSessions
    ] = await Promise.all([
      selectProgramsBatch(serverClient, programIds),
      selectProgramDaysBatch(serverClient, currentDayIds),
      selectAllProgramWeeksByProgramIds(serverClient, programIds),
      selectRecentSessionsForEnrollments(serverClient, userId, enrollmentIds),
      selectTrendSessions(serverClient, userId, enrollmentIds),
      selectInProgressSessionsForEnrollments(serverClient, enrollmentIds)
    ]);

    // Collect IDs needed for batch 2
    const currentDayWeekIds = [...new Set(currentDays.map((d) => d.program_week_id))];
    const allWeekIds = allWeeks.map((w) => w.id);
    const sessionDayIds = [
      ...new Set(
        recentSessions
          .map((s) => s.program_day_id)
          .filter((id): id is string => Boolean(id))
      )
    ];
    const trendSessionIds = trendSessions.map((s) => s.id);

    // ── Batch 2: unblocked after batch 1 ─────────────────────────────────
    const [currentWeeks, allDays, sessionDays, trendExercises] = await Promise.all([
      selectProgramWeeksBatch(serverClient, currentDayWeekIds),
      selectAllProgramDays(serverClient, allWeekIds),
      selectProgramDaysBatch(serverClient, sessionDayIds),
      selectTrendExercises(serverClient, trendSessionIds)
    ]);

    // Collect IDs needed for batch 3
    const sessionWeekIds = [...new Set(sessionDays.map((d) => d.program_week_id))];
    const trendExerciseIds = trendExercises.map((e) => e.id);

    // ── Batch 3: parallel (sessionWeeks + trendSets) ──────────────────────
    const [sessionWeeks, trendSets] = await Promise.all([
      selectProgramWeeksBatch(serverClient, sessionWeekIds),
      selectTrendSets(serverClient, trendExerciseIds)
    ]);

    // ── Build lookup maps ─────────────────────────────────────────────────
    const programMap = new Map(programs.map((p) => [p.id, p]));
    const currentDayMap = new Map(currentDays.map((d) => [d.id, d]));
    const currentWeekMap = new Map(currentWeeks.map((w) => [w.id, w]));
    const sessionDayMap = new Map(sessionDays.map((d) => [d.id, d]));
    const sessionWeekMap = new Map(sessionWeeks.map((w) => [w.id, w]));

    // Group allWeeks and allDays by program_id for per-enrollment progress
    const weeksByProgramId = new Map<string, ProgramWeekWithProgramId[]>();
    for (const w of allWeeks) {
      const list = weeksByProgramId.get(w.program_id) ?? [];
      list.push(w);
      weeksByProgramId.set(w.program_id, list);
    }

    const weekIdToProgramId = new Map(allWeeks.map((w) => [w.id, w.program_id]));

    const daysByProgramId = new Map<string, ProgramDayRow[]>();
    for (const day of allDays) {
      const pid = weekIdToProgramId.get(day.program_week_id);
      if (!pid) continue;
      const list = daysByProgramId.get(pid) ?? [];
      list.push(day);
      daysByProgramId.set(pid, list);
    }

    // Group recent sessions by enrollment_id (top RECENT_SESSION_LIMIT each)
    const sessionsByEnrollmentId = new Map<string, SessionRow[]>();
    for (const s of recentSessions) {
      if (!s.program_enrollment_id) continue;
      const list = sessionsByEnrollmentId.get(s.program_enrollment_id) ?? [];
      if (list.length < RECENT_SESSION_LIMIT) {
        list.push(s);
        sessionsByEnrollmentId.set(s.program_enrollment_id, list);
      }
    }

    // S-2: Build in-progress session map (enrollment_id → InProgressSessionRow)
    // Only the most recent in-progress session per enrollment is stored (DESC order).
    const inProgressByEnrollmentId = new Map<string, InProgressSessionRow>();
    for (const s of inProgressSessions) {
      if (!inProgressByEnrollmentId.has(s.program_enrollment_id)) {
        inProgressByEnrollmentId.set(s.program_enrollment_id, s);
      }
    }

    // H-4: Aggregate session volumes across all trend sessions
    const sessionVolumeMap = aggregateSessionVolumes(
      trendSessions,
      trendExercises,
      trendSets
    );

    // ── Build one view per enrollment ─────────────────────────────────────
    const views: ActiveProgramView[] = enrollments.map((enrollment) => {
      const program = programMap.get(enrollment.program_id);
      const programSlug = program?.slug ?? "";

      const currentDay = enrollment.current_program_day_id
        ? (currentDayMap.get(enrollment.current_program_day_id) ?? null)
        : null;
      const currentWeek = currentDay
        ? (currentWeekMap.get(currentDay.program_week_id) ?? null)
        : null;

      const programWeeks = weeksByProgramId.get(enrollment.program_id) ?? [];
      const programDays = daysByProgramId.get(enrollment.program_id) ?? [];
      const { completedDays, totalDays, progressPercent } = computeProgress(
        programWeeks,
        programDays,
        enrollment.current_program_day_id
      );

      const enrollmentSessions = sessionsByEnrollmentId.get(enrollment.id) ?? [];
      const recentSessionViews: ActiveProgramSession[] = enrollmentSessions.map(
        (session) => {
          const day = session.program_day_id
            ? (sessionDayMap.get(session.program_day_id) ?? null)
            : null;
          const week = day ? (sessionWeekMap.get(day.program_week_id) ?? null) : null;

          return {
            sessionId: session.id,
            startedAt: formatSessionDate(session.started_at),
            status: session.status,
            programWeekDayLabel: buildWeekDayLabel(
              week?.week_number ?? null,
              week?.label ?? null,
              day?.day_number ?? null
            )
          };
        }
      );

      // H-4: build volume trend for this enrollment
      const trend = buildVolumeTrend(enrollment.id, trendSessions, sessionVolumeMap);

      // H-4b: build e1RM trend for the primary T1 lift of this enrollment
      const e1rmTrend = buildE1RMTrend(
        enrollment.id,
        trendSessions,
        trendExercises,
        trendSets
      );

      // S-2: Determine actionType and resume URL
      const inProgressSession = inProgressByEnrollmentId.get(enrollment.id) ?? null;
      const activeSessionId = inProgressSession?.id ?? null;

      // Resume URL uses the in-progress session's program_day_id when available,
      // so the train page finds the exact session rather than relying on
      // current_program_day_id (which may have advanced in edge cases).
      const resumeDayId =
        inProgressSession?.program_day_id ?? enrollment.current_program_day_id;

      const continueUrl = resumeDayId
        ? `/train?program=${programSlug}&programDayId=${resumeDayId}`
        : `/train?program=${programSlug}`;

      const actionType: "start" | "resume" | "none" =
        activeSessionId !== null
          ? "resume"
          : enrollment.current_program_day_id !== null
          ? "start"
          : "none";

      return {
        enrollmentId: enrollment.id,
        programId: enrollment.program_id,
        programSlug,
        programTitle: program?.title ?? "Current Program",
        level: program?.level ?? null,
        frequencyLabel: formatFrequency(program?.days_per_week ?? 0),
        durationLabel: formatDuration(program?.duration_weeks ?? 0),
        currentProgramDayId: enrollment.current_program_day_id,
        currentWeekDayLabel: buildWeekDayLabel(
          currentWeek?.week_number ?? null,
          currentWeek?.label ?? null,
          currentDay?.day_number ?? null
        ),
        continueUrl,
        enrollmentStartedAt: enrollment.started_at,
        recentSessions: recentSessionViews,
        completedDays,
        totalDays,
        progressPercent,
        trend,
        e1rmTrend,
        actionType,
        activeSessionId
      };
    });

    return { views, isAuthenticated: true, errorMessage: null };
  } catch (error) {
    console.error("Failed to load active program view.", error);

    return {
      views: [],
      isAuthenticated: true,
      errorMessage: "Could not load your active program. Please try again."
    };
  }
}

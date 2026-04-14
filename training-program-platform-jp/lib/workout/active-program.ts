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
  WorkoutSessionStatus
} from "@/types/workout";

type DatabaseClient = SupabaseClient;

const RECENT_SESSION_LIMIT = 3;

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

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Returns all active enrollments for the user, ordered by most-recently-
 * updated first (updated_at desc, created_at desc as fallback).
 * H-3c: replaces single-enrollment LIMIT 1 query.
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

/**
 * Batch-fetches programs by ID list. One query for all enrollments.
 */
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

/**
 * Batch-fetches program_days for the given day IDs.
 * Used both for current_program_day_id lookups and session day lookups.
 */
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

/**
 * Batch-fetches program_weeks by week ID list.
 * Used for current-week label and session-week label lookups.
 */
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

/**
 * Batch-fetches all program weeks for the given program IDs (includes
 * program_id for grouping). Used to build totalDays / progress per program.
 * H-3c: replaces single-program selectAllProgramWeeks.
 */
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

/**
 * Batch-fetches all program_days for the given week IDs.
 * Called once with all week IDs across all enrollments.
 */
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

/**
 * Fetches recent sessions for the given enrollment IDs, ordered by
 * started_at desc. Returns enough rows to give up to RECENT_SESSION_LIMIT
 * per enrollment after in-memory grouping.
 *
 * H-3c: replaces global user-scoped query; filters by enrollment so each
 * card shows only its own sessions. Sessions without a matched
 * program_enrollment_id are excluded (e.g. free-training sessions).
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
// Progress computation
// ---------------------------------------------------------------------------

type ProgressResult = {
  completedDays: number;
  totalDays: number;
  progressPercent: number;
};

/**
 * Computes progress for a single enrollment.
 *
 * - allWeeks: weeks belonging to this enrollment's program (week_number for sort)
 * - allDays:  days belonging to this enrollment's program
 * - currentProgramDayId: the *next* day to do; its 0-based index = completedDays
 *
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

  // currentIndex === -1 means null or unknown day → treat as 0 completed (safe)
  const completedDays = currentIndex >= 0 ? currentIndex : 0;
  const progressPercent = Math.round((completedDays / totalDays) * 100);

  return { completedDays, totalDays, progressPercent };
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
 * H-3c: Returns all active program views for the current user.
 *
 * Query budget: 9 queries regardless of enrollment count (N+1 free).
 *   1. selectActiveEnrollments
 *   2–5. parallel: programs, currentDays, allWeeks, recentSessions
 *   6–8. parallel: currentWeeks, allDays, sessionDays
 *   9. sessionWeeks
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

    // Deduplicate program IDs (multiple enrollments may share a program)
    const programIds = [...new Set(enrollments.map((e) => e.program_id))];

    // Collect current_program_day_ids (non-null only)
    const currentDayIds = enrollments
      .map((e) => e.current_program_day_id)
      .filter((id): id is string => Boolean(id));

    // ── Batch 1: all independent ──────────────────────────────────────────
    const [programs, currentDays, allWeeks, recentSessions] = await Promise.all([
      selectProgramsBatch(serverClient, programIds),
      selectProgramDaysBatch(serverClient, currentDayIds),
      selectAllProgramWeeksByProgramIds(serverClient, programIds),
      selectRecentSessionsForEnrollments(
        serverClient,
        userId,
        enrollments.map((e) => e.id)
      )
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

    // ── Batch 2: unblocked after batch 1 ─────────────────────────────────
    const [currentWeeks, allDays, sessionDays] = await Promise.all([
      selectProgramWeeksBatch(serverClient, currentDayWeekIds),
      selectAllProgramDays(serverClient, allWeekIds),
      selectProgramDaysBatch(serverClient, sessionDayIds)
    ]);

    // ── Batch 3: session weeks (depends on sessionDays) ──────────────────
    const sessionWeekIds = [...new Set(sessionDays.map((d) => d.program_week_id))];
    const sessionWeeks = await selectProgramWeeksBatch(serverClient, sessionWeekIds);

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

    // week_id → program_id (needed to assign days to a program)
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

      const continueUrl = enrollment.current_program_day_id
        ? `/train?program=${programSlug}&programDayId=${enrollment.current_program_day_id}`
        : `/train?program=${programSlug}`;

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
        progressPercent
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

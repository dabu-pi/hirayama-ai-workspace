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
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

async function selectActiveEnrollment(
  client: DatabaseClient,
  userId: string
): Promise<EnrollmentRow | null> {
  const { data, error } = await client
    .from("program_enrollments")
    .select("id, program_id, current_program_day_id, status, started_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle<EnrollmentRow>();

  if (error) {
    throw new Error(`Failed to load active enrollment: ${error.message}`);
  }

  return data;
}

async function selectProgram(
  client: DatabaseClient,
  programId: string
): Promise<ProgramRow | null> {
  const { data, error } = await client
    .from("programs")
    .select("id, slug, title, level, days_per_week, duration_weeks")
    .eq("id", programId)
    .maybeSingle<ProgramRow>();

  if (error) {
    throw new Error(`Failed to load program: ${error.message}`);
  }

  return data;
}

async function selectProgramDay(
  client: DatabaseClient,
  programDayId: string | null
): Promise<ProgramDayRow | null> {
  if (!programDayId) return null;

  const { data, error } = await client
    .from("program_days")
    .select("id, day_number, program_week_id")
    .eq("id", programDayId)
    .maybeSingle<ProgramDayRow>();

  if (error) return null;

  return data;
}

async function selectProgramWeek(
  client: DatabaseClient,
  programWeekId: string | null
): Promise<ProgramWeekRow | null> {
  if (!programWeekId) return null;

  const { data, error } = await client
    .from("program_weeks")
    .select("id, week_number, label")
    .eq("id", programWeekId)
    .maybeSingle<ProgramWeekRow>();

  if (error) return null;

  return data;
}

async function selectRecentSessions(
  client: DatabaseClient,
  userId: string
): Promise<SessionRow[]> {
  const { data, error } = await client
    .from("workout_sessions")
    .select("id, started_at, status, program_day_id")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(RECENT_SESSION_LIMIT);

  if (error) return [];

  return (data ?? []) as SessionRow[];
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

export async function getActiveProgramView(): Promise<ActiveProgramResult> {
  if (!hasSupabasePublicEnv()) {
    return {
      view: null,
      isAuthenticated: false,
      errorMessage: "Supabase is not configured for this environment."
    };
  }

  try {
    const serverClient = createSupabaseServerClient();
    const scopedUser = await serverClient.auth.getUser();
    const userId = scopedUser.data.user?.id ?? null;

    if (!userId) {
      return { view: null, isAuthenticated: false, errorMessage: null };
    }

    const enrollment = await selectActiveEnrollment(serverClient, userId);

    if (!enrollment) {
      return { view: null, isAuthenticated: true, errorMessage: null };
    }

    // Resolve program, current day/week in parallel where possible
    const [program, currentDay, recentSessions] = await Promise.all([
      selectProgram(serverClient, enrollment.program_id),
      selectProgramDay(serverClient, enrollment.current_program_day_id),
      selectRecentSessions(serverClient, userId)
    ]);

    const currentWeek = await selectProgramWeek(
      serverClient,
      currentDay?.program_week_id ?? null
    );

    // Build recent session labels
    const sessionDayIds = recentSessions
      .map((s) => s.program_day_id)
      .filter((id): id is string => Boolean(id));

    const sessionDays = await selectProgramDaysBatch(serverClient, sessionDayIds);
    const sessionDayMap = new Map(sessionDays.map((d) => [d.id, d]));

    const sessionWeekIds = Array.from(
      new Set(sessionDays.map((d) => d.program_week_id))
    );
    const sessionWeeks = await selectProgramWeeksBatch(serverClient, sessionWeekIds);
    const sessionWeekMap = new Map(sessionWeeks.map((w) => [w.id, w]));

    const recentSessionViews: ActiveProgramSession[] = recentSessions.map((session) => {
      const day = session.program_day_id
        ? sessionDayMap.get(session.program_day_id) ?? null
        : null;
      const week = day ? sessionWeekMap.get(day.program_week_id) ?? null : null;

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
    });

    const programSlug = program?.slug ?? "";
    const continueUrl = enrollment.current_program_day_id
      ? `/train?program=${programSlug}&programDayId=${enrollment.current_program_day_id}`
      : `/train?program=${programSlug}`;

    const view: ActiveProgramView = {
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
      recentSessions: recentSessionViews
    };

    return { view, isAuthenticated: true, errorMessage: null };
  } catch (error) {
    console.error("Failed to load active program view.", error);

    return {
      view: null,
      isAuthenticated: true,
      errorMessage: "Could not load your active program. Please try again."
    };
  }
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";
import { jstDateSlice } from "@/lib/utils/date-jst";
import type {
  CalendarDayEntry,
  CalendarMonthResult,
  SessionHistoryResult,
  WorkoutSessionListItem,
  WorkoutSessionStatus
} from "@/types/workout";

type DaySessionResult = {
  sessions: WorkoutSessionListItem[];
  errorMessage: string | null;
};

const SESSION_LIST_LIMIT = 20;

type DatabaseClient = SupabaseClient;

type SessionRow = {
  id: string;
  status: WorkoutSessionStatus;
  started_at: string;
  finished_at: string | null;
  program_day_id: string | null;
};

type SessionExerciseRow = {
  workout_session_id: string;
};

type ProgramDayRow = {
  id: string;
  program_week_id: string;
  day_number: number;
};

type ProgramWeekRow = {
  id: string;
  program_id: string;
  week_number: number;
  label: string | null;
};

type ProgramRow = {
  id: string;
  title: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoString: string) {
  return jstDateSlice(isoString);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

async function selectSessions(client: DatabaseClient, userId: string) {
  const { data, error } = await client
    .from("workout_sessions")
    .select("id, status, started_at, finished_at, program_day_id")
    .eq("user_id", userId)
    .neq("status", "cancelled")
    .is("archived_at", null)
    .order("started_at", { ascending: false })
    .limit(SESSION_LIST_LIMIT);

  if (error) throw new Error(`Failed to load sessions: ${error.message}`);
  return (data ?? []) as SessionRow[];
}

async function selectSessionExercises(client: DatabaseClient, sessionIds: string[]) {
  if (sessionIds.length === 0) return [] as SessionExerciseRow[];

  const { data, error } = await client
    .from("workout_session_exercises")
    .select("workout_session_id")
    .in("workout_session_id", sessionIds);

  if (error) throw new Error(`Failed to load exercise counts: ${error.message}`);
  return (data ?? []) as SessionExerciseRow[];
}

async function selectProgramDays(client: DatabaseClient, programDayIds: string[]) {
  if (programDayIds.length === 0) return [] as ProgramDayRow[];

  const { data, error } = await client
    .from("program_days")
    .select("id, program_week_id, day_number")
    .in("id", programDayIds);

  if (error) throw new Error(`Failed to load program days: ${error.message}`);
  return (data ?? []) as ProgramDayRow[];
}

async function selectProgramWeeks(client: DatabaseClient, programWeekIds: string[]) {
  if (programWeekIds.length === 0) return [] as ProgramWeekRow[];

  const { data, error } = await client
    .from("program_weeks")
    .select("id, program_id, week_number, label")
    .in("id", programWeekIds);

  if (error) throw new Error(`Failed to load program weeks: ${error.message}`);
  return (data ?? []) as ProgramWeekRow[];
}

async function selectPrograms(client: DatabaseClient, programIds: string[]) {
  if (programIds.length === 0) return [] as ProgramRow[];

  const { data, error } = await client
    .from("programs")
    .select("id, title")
    .in("id", programIds);

  if (error) throw new Error(`Failed to load programs: ${error.message}`);
  return (data ?? []) as ProgramRow[];
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function getSessionHistoryView(): Promise<SessionHistoryResult> {
  if (!hasSupabasePublicEnv()) {
    return { sessions: [], errorMessage: "Supabase is not configured for this environment." };
  }

  try {
    const serverClient = createSupabaseServerClient();
    const { data: userData } = await serverClient.auth.getUser();
    const userId = userData.user?.id ?? null;

    if (!userId) {
      return { sessions: [], errorMessage: "Sign in is required to view session history." };
    }

    const sessions = await selectSessions(serverClient, userId);

    if (sessions.length === 0) {
      return { sessions: [], errorMessage: null };
    }

    const sessionIds = sessions.map((s) => s.id);
    const programDayIds = Array.from(
      new Set(sessions.map((s) => s.program_day_id).filter((id): id is string => id !== null))
    );

    // Exercise counts and program days are both independent of each other — run in parallel.
    const [exerciseRows, programDays] = await Promise.all([
      selectSessionExercises(serverClient, sessionIds),
      selectProgramDays(serverClient, programDayIds)
    ]);

    const exerciseCountMap = new Map<string, number>();
    exerciseRows.forEach((row) => {
      exerciseCountMap.set(
        row.workout_session_id,
        (exerciseCountMap.get(row.workout_session_id) ?? 0) + 1
      );
    });
    const programDayMap = new Map(programDays.map((d) => [d.id, d]));

    const programWeekIds = Array.from(new Set(programDays.map((d) => d.program_week_id)));
    const programWeeks = await selectProgramWeeks(serverClient, programWeekIds);
    const programWeekMap = new Map(programWeeks.map((w) => [w.id, w]));

    const programIds = Array.from(new Set(programWeeks.map((w) => w.program_id)));
    const programs = await selectPrograms(serverClient, programIds);
    const programMap = new Map(programs.map((p) => [p.id, p]));

    const items: WorkoutSessionListItem[] = sessions.map((session) => {
      const programDay =
        session.program_day_id ? (programDayMap.get(session.program_day_id) ?? null) : null;
      const programWeek = programDay
        ? (programWeekMap.get(programDay.program_week_id) ?? null)
        : null;
      const program = programWeek ? (programMap.get(programWeek.program_id) ?? null) : null;

      let programWeekDayLabel: string | null = null;
      if (programWeek && programDay) {
        const weekPart = programWeek.label?.trim() || `Week ${programWeek.week_number}`;
        programWeekDayLabel = `${weekPart} / Day ${programDay.day_number}`;
      }

      return {
        sessionId: session.id,
        status: session.status,
        startedAt: formatDate(session.started_at),
        finishedAt: session.finished_at ? formatDate(session.finished_at) : null,
        programTitle: program?.title ?? null,
        programWeekDayLabel,
        exerciseCount: exerciseCountMap.get(session.id) ?? 0
      };
    });

    return { sessions: items, errorMessage: null };
  } catch (error) {
    console.error("Failed to load session history from Supabase.", error);
    return {
      sessions: [],
      errorMessage: "Session history could not be loaded right now. Please try again."
    };
  }
}

// ---------------------------------------------------------------------------
// H-2: Calendar-specific lightweight query
// Fetches only date + count for completed sessions in a given month.
// Independent of SESSION_LIST_LIMIT — covers all sessions in the month.
// ---------------------------------------------------------------------------

export async function getCalendarMonthData(
  year: number,
  month: number // 0-indexed (0 = January), matches JS Date.getMonth()
): Promise<CalendarMonthResult> {
  if (!hasSupabasePublicEnv()) {
    return { entries: [], errorMessage: "Supabase is not configured for this environment." };
  }
  try {
    const serverClient = createSupabaseServerClient();
    const { data: userData } = await serverClient.auth.getUser();
    const userId = userData.user?.id ?? null;
    if (!userId) return { entries: [], errorMessage: "Sign in is required." };

    // UTC range that covers the full JST month (JST = UTC+9, so start from UTC month-1 day 15+)
    // Using a generous range: from the 1st of the UTC month - 1 day to the 1st of UTC month + 1
    // to ensure all JST-date sessions are captured regardless of UTC/JST boundary.
    const rangeStart = new Date(Date.UTC(year, month - 1, 25)).toISOString();
    const rangeEnd = new Date(Date.UTC(year, month + 1, 1)).toISOString();

    const { data, error } = await serverClient
      .from("workout_sessions")
      .select("started_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .is("archived_at", null)
      .gte("started_at", rangeStart)
      .lt("started_at", rangeEnd);

    if (error) throw new Error(error.message);

    const targetMonthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const countByDate: Record<string, number> = {};
    for (const row of data ?? []) {
      const dateStr = jstDateSlice(row.started_at);
      if (dateStr.startsWith(targetMonthPrefix)) {
        countByDate[dateStr] = (countByDate[dateStr] ?? 0) + 1;
      }
    }

    const entries: CalendarDayEntry[] = Object.entries(countByDate).map(([date, count]) => ({
      date,
      count,
    }));
    return { entries, errorMessage: null };
  } catch (err) {
    console.error("getCalendarMonthData failed", err);
    return { entries: [], errorMessage: "Calendar data could not be loaded." };
  }
}

// ---------------------------------------------------------------------------
// H-1d: Day-specific session query for calendar selected-day detail panel.
// Returns full WorkoutSessionListItem[] for a given JST date.
// Independent of SESSION_LIST_LIMIT.
// ---------------------------------------------------------------------------

export async function getDaySessionData(date: string): Promise<DaySessionResult> {
  if (!hasSupabasePublicEnv()) {
    return { sessions: [], errorMessage: "Supabase is not configured for this environment." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { sessions: [], errorMessage: "Invalid date format." };
  }
  try {
    const serverClient = createSupabaseServerClient();
    const { data: userData } = await serverClient.auth.getUser();
    const userId = userData.user?.id ?? null;
    if (!userId) return { sessions: [], errorMessage: "Sign in is required." };

    // JST day YYYY-MM-DD spans UTC [day-1 T15:00:00Z, day T15:00:00Z).
    const [year, monthStr, dayStr] = date.split("-").map(Number);
    const month = monthStr - 1; // 0-indexed
    const utcStart = new Date(Date.UTC(year, month, dayStr - 1, 15, 0, 0)).toISOString();
    const utcEnd = new Date(Date.UTC(year, month, dayStr, 15, 0, 0)).toISOString();

    const { data, error } = await serverClient
      .from("workout_sessions")
      .select("id, status, started_at, finished_at, program_day_id")
      .eq("user_id", userId)
      .eq("status", "completed")
      .is("archived_at", null)
      .gte("started_at", utcStart)
      .lt("started_at", utcEnd)
      .order("started_at", { ascending: true });

    if (error) throw new Error(error.message);

    // Re-filter by JST date string to guard against UTC/JST boundary edge cases.
    const sessions = ((data ?? []) as SessionRow[]).filter(
      (s) => jstDateSlice(s.started_at) === date
    );

    if (sessions.length === 0) return { sessions: [], errorMessage: null };

    const sessionIds = sessions.map((s) => s.id);
    const programDayIds = Array.from(
      new Set(sessions.map((s) => s.program_day_id).filter((id): id is string => id !== null))
    );

    const [exerciseRows, programDays] = await Promise.all([
      selectSessionExercises(serverClient, sessionIds),
      selectProgramDays(serverClient, programDayIds),
    ]);

    const exerciseCountMap = new Map<string, number>();
    exerciseRows.forEach((row) => {
      exerciseCountMap.set(
        row.workout_session_id,
        (exerciseCountMap.get(row.workout_session_id) ?? 0) + 1
      );
    });
    const programDayMap = new Map(programDays.map((d) => [d.id, d]));

    const programWeekIds = Array.from(new Set(programDays.map((d) => d.program_week_id)));
    const programWeeks = await selectProgramWeeks(serverClient, programWeekIds);
    const programWeekMap = new Map(programWeeks.map((w) => [w.id, w]));

    const programIds = Array.from(new Set(programWeeks.map((w) => w.program_id)));
    const programs = await selectPrograms(serverClient, programIds);
    const programMap = new Map(programs.map((p) => [p.id, p]));

    const items: WorkoutSessionListItem[] = sessions.map((session) => {
      const programDay = session.program_day_id
        ? (programDayMap.get(session.program_day_id) ?? null)
        : null;
      const programWeek = programDay
        ? (programWeekMap.get(programDay.program_week_id) ?? null)
        : null;
      const program = programWeek ? (programMap.get(programWeek.program_id) ?? null) : null;

      let programWeekDayLabel: string | null = null;
      if (programWeek && programDay) {
        const weekPart = programWeek.label?.trim() || `Week ${programWeek.week_number}`;
        programWeekDayLabel = `${weekPart} / Day ${programDay.day_number}`;
      }

      return {
        sessionId: session.id,
        status: session.status,
        startedAt: formatDate(session.started_at),
        finishedAt: session.finished_at ? formatDate(session.finished_at) : null,
        programTitle: program?.title ?? null,
        programWeekDayLabel,
        exerciseCount: exerciseCountMap.get(session.id) ?? 0,
      };
    });

    return { sessions: items, errorMessage: null };
  } catch (err) {
    console.error("getDaySessionData failed", err);
    return { sessions: [], errorMessage: "この日の履歴を取得できませんでした。" };
  }
}

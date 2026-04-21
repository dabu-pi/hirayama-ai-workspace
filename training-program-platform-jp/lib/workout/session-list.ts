import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";
import type {
  SessionHistoryResult,
  WorkoutSessionListItem,
  WorkoutSessionStatus
} from "@/types/workout";

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
  if (/^\d{4}-\d{2}-\d{2}/.test(isoString)) return isoString.slice(0, 10);
  const parsed = new Date(isoString);
  return Number.isNaN(parsed.getTime()) ? isoString : parsed.toISOString().slice(0, 10);
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

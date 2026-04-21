import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getMockWorkoutSession } from "@/lib/mock/workout";
import { hasSupabasePublicEnv } from "@/lib/supabase/server";
import {
  createWorkoutQueryClient,
  getAuthenticatedWorkoutUserId
} from "@/lib/workout/session-access";
import { selectT1ProgressionHints } from "@/lib/workout/t1-progression";
import type {
  ExerciseType,
  PreviousSet,
  T1ProgressionHint,
  WorkoutExerciseBlock,
  WorkoutSessionStatus,
  WorkoutSessionView
} from "@/types/workout";

type DatabaseClient = SupabaseClient;

type WorkoutSessionRow = {
  id: string;
  user_id: string;
  program_enrollment_id: string | null;
  program_day_id: string | null;
  started_at: string;
  finished_at: string | null;
  status: WorkoutSessionStatus;
};

type ProgramDayRow = {
  id: string;
  program_week_id: string;
  day_number: number;
  progression_guide: string | null;
  notes: string | null;
};

type ProgramWeekRow = {
  id: string;
  program_id: string;
  week_number: number;
  label: string | null;
};

type ProgramDayWithWeekRow = {
  id: string;
  day_number: number;
  progression_guide: string | null;
  notes: string | null;
  program_weeks: ProgramWeekRow | null;
};

type ProgramRow = {
  id: string;
  title: string;
  methodology: string | null;
};

type WorkoutSessionExerciseRow = {
  id: string;
  workout_session_id: string;
  exercise_id: string;
  exercise_type: ExerciseType;
  order_index: number;
  was_swapped: boolean;
  was_added: boolean;
  swap_group_slug: string | null;
};

type ExerciseRow = {
  id: string;
  slug: string;
  name_ja: string;
  name_en: string;
};

type WorkoutSetRow = {
  id: string;
  workout_session_exercise_id: string;
  set_number: number;
  target_reps_text: string | null;
  weight_kg: number | string | null;
  reps_done: number | null;
  is_completed: boolean;
  is_locked: boolean;
  completed_at: string | null;
  is_auto_filled: boolean;
  note: string | null;
  deleted_at: string | null;
};

type HistoricalSetEmbeddedRow = {
  set_number: number;
  weight_kg: number | string | null;
  reps_done: number | null;
  deleted_at: string | null;
};

// R5: merged type — carries session started_at + embedded sets in a single query.
type HistoricalExerciseWithSetsRow = {
  id: string;
  workout_session_id: string;
  exercise_id: string;
  exercise_type: ExerciseType;
  workout_sessions: { started_at: string } | null;
  workout_sets: HistoricalSetEmbeddedRow[] | null;
};


function toNullableNumber(value: number | string | null): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildProgramWeekLabel(
  weekNumber: number | null,
  weekLabel: string | null,
  dayNumber: number | null
) {
  const weekPart =
    weekLabel?.trim() ||
    (weekNumber ? `Week ${weekNumber}` : "");

  return dayNumber ? `${weekPart} / Day ${dayNumber}` : weekPart;
}

function formatPreviousDisplay(
  weightKg: number | null,
  repsDone: number | null
) {
  if (weightKg === null && repsDone === null) {
    return "-";
  }

  if (weightKg !== null && repsDone !== null) {
    return `${weightKg}kg x ${repsDone}`;
  }

  if (weightKg !== null) {
    return `${weightKg}kg`;
  }

  return `x ${repsDone}`;
}

async function selectCurrentInProgressSession(
  client: DatabaseClient,
  userId: string
) {
  const { data: inProgressSession, error: inProgressError } = await client
    .from("workout_sessions")
    .select(
      "id, user_id, program_enrollment_id, program_day_id, started_at, finished_at, status"
    )
    .eq("status", "in_progress")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<WorkoutSessionRow>();

  if (inProgressError) {
    throw new Error(
      `Failed to load current workout session: ${inProgressError.message}`
    );
  }

  return inProgressSession;
}

async function selectSessionByDayId(
  client: DatabaseClient,
  programDayId: string,
  userId: string
) {
  const { data, error } = await client
    .from("workout_sessions")
    .select(
      "id, user_id, program_enrollment_id, program_day_id, started_at, finished_at, status"
    )
    .eq("status", "in_progress")
    .eq("program_day_id", programDayId)
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<WorkoutSessionRow>();

  if (error) {
    throw new Error(`Failed to find session by day id: ${error.message}`);
  }

  return data;
}

async function selectProgramDay(
  client: DatabaseClient,
  programDayId: string | null
) {
  if (!programDayId) return null;

  const { data, error } = await client
    .from("program_days")
    .select("id, program_week_id, day_number, progression_guide, notes")
    .eq("id", programDayId)
    .maybeSingle<ProgramDayRow>();

  if (error) {
    throw new Error(`Failed to load program day: ${error.message}`);
  }

  return data;
}

async function selectProgramDayWithWeek(
  client: DatabaseClient,
  programDayId: string | null
) {
  if (!programDayId) return null;

  const { data, error } = await client
    .from("program_days")
    .select("id, day_number, progression_guide, notes, program_weeks(id, program_id, week_number, label)")
    .eq("id", programDayId)
    .maybeSingle<ProgramDayWithWeekRow>();

  if (error) {
    throw new Error(`Failed to load program day with week: ${error.message}`);
  }

  return data;
}

async function selectProgramWeek(
  client: DatabaseClient,
  programWeekId: string | null
) {
  if (!programWeekId) return null;

  const { data, error } = await client
    .from("program_weeks")
    .select("id, program_id, week_number, label")
    .eq("id", programWeekId)
    .maybeSingle<ProgramWeekRow>();

  if (error) {
    throw new Error(`Failed to load program week: ${error.message}`);
  }

  return data;
}

async function selectProgram(client: DatabaseClient, programId: string | null) {
  if (!programId) return null;

  const { data, error } = await client
    .from("programs")
    .select("id, title, methodology")
    .eq("id", programId)
    .maybeSingle<ProgramRow>();

  if (error) {
    throw new Error(`Failed to load program: ${error.message}`);
  }

  return data;
}

const EXERCISE_ROLE_LABELS: Record<string, Record<ExerciseType, string>> = {
  gzcl:    { T1: "T1（メイン種目）", T2: "T2（補助種目）", T3: "T3（ボリューム）" },
  linear:  { T1: "メイン",           T2: "補助",           T3: "アクセサリー" },
  generic: { T1: "",                 T2: "",               T3: "" },
  custom:  { T1: "",                 T2: "",               T3: "" }
};

function resolveExerciseRoleLabel(
  exerciseType: ExerciseType,
  methodology: string | null
): string {
  const map = EXERCISE_ROLE_LABELS[methodology ?? "gzcl"] ?? EXERCISE_ROLE_LABELS.gzcl;
  return map[exerciseType];
}

async function selectWorkoutSessionExercises(
  client: DatabaseClient,
  workoutSessionId: string
) {
  const { data, error } = await client
    .from("workout_session_exercises")
    .select(
      "id, workout_session_id, exercise_id, exercise_type, order_index, was_swapped, was_added, swap_group_slug"
    )
    .eq("workout_session_id", workoutSessionId)
    .order("order_index", { ascending: true });

  if (error) {
    throw new Error(`Failed to load workout exercises: ${error.message}`);
  }

  return (data ?? []) as WorkoutSessionExerciseRow[];
}

async function selectExercises(client: DatabaseClient, exerciseIds: string[]) {
  if (exerciseIds.length === 0) {
    return [] as ExerciseRow[];
  }

  const { data, error } = await client
    .from("exercises")
    .select("id, slug, name_ja, name_en")
    .in("id", exerciseIds);

  if (error) {
    throw new Error(`Failed to load exercises: ${error.message}`);
  }

  return (data ?? []) as ExerciseRow[];
}

async function selectVisibleWorkoutSets(
  client: DatabaseClient,
  workoutSessionExerciseIds: string[]
) {
  if (workoutSessionExerciseIds.length === 0) {
    return [] as WorkoutSetRow[];
  }

  const { data, error } = await client
    .from("workout_sets")
    .select(
      "id, workout_session_exercise_id, set_number, target_reps_text, weight_kg, reps_done, is_completed, is_locked, completed_at, is_auto_filled, note, deleted_at"
    )
    .in("workout_session_exercise_id", workoutSessionExerciseIds)
    .is("deleted_at", null)
    .order("workout_session_exercise_id", { ascending: true })
    .order("set_number", { ascending: true });

  if (error) {
    throw new Error(`Failed to load workout sets: ${error.message}`);
  }

  return (data ?? []) as WorkoutSetRow[];
}

// R5: merged Q1+Q2 — fetches historical exercise rows with session started_at and embedded sets
// in a single query. Replaces the previous two-step flow (Q1 exercises → Q2 sets via IN clause).
// deleted_at filtering for embedded sets is done in memory; PostgREST doesn't cleanly filter
// embedded child rows without also filtering the parent row.
// limit(400) ≈ 20 sessions × 20 exercises — generous for typical user history.
async function selectHistoricalExercisesWithSets(
  client: DatabaseClient,
  userId: string,
  uniqueExerciseIds: string[]
) {
  if (uniqueExerciseIds.length === 0) return [] as HistoricalExerciseWithSetsRow[];

  const { data, error } = await client
    .from("workout_session_exercises")
    .select(
      "id, workout_session_id, exercise_id, exercise_type, workout_sessions!inner(started_at), workout_sets(set_number, weight_kg, reps_done, deleted_at)"
    )
    .in("exercise_id", uniqueExerciseIds)
    .eq("workout_sessions.user_id", userId)
    .eq("workout_sessions.status", "completed")
    .is("workout_sessions.archived_at", null)
    .limit(400);

  if (error) {
    throw new Error(`Failed to load historical exercises with sets: ${error.message}`);
  }

  return (data ?? []) as unknown as HistoricalExerciseWithSetsRow[];
}

async function buildPreviousDisplayMap(
  client: DatabaseClient,
  currentSession: WorkoutSessionRow,
  workoutSessionExercises: WorkoutSessionExerciseRow[],
  workoutSets: WorkoutSetRow[]
): Promise<{ displayMap: Map<string, string>; previousSetsMap: Map<string, PreviousSet[]> }> {
  const empty = { displayMap: new Map<string, string>(), previousSetsMap: new Map<string, PreviousSet[]>() };

  const uniqueExerciseIds = Array.from(
    new Set(workoutSessionExercises.map((item) => item.exercise_id))
  );

  if (uniqueExerciseIds.length === 0 || workoutSets.length === 0) {
    return empty;
  }

  if (!currentSession.user_id) {
    return empty;
  }

  // R5: merged Q1+Q2 — single query fetches historical exercises with embedded sets.
  // Graceful degradation: if the embedded filter fails, return empty map so WorkoutScreen
  // still renders with previousDisplay showing "-" instead of crashing.
  const tPrev = Date.now();
  let historicalExercisesWithSets: HistoricalExerciseWithSetsRow[];
  try {
    historicalExercisesWithSets = await selectHistoricalExercisesWithSets(
      client,
      currentSession.user_id,
      uniqueExerciseIds
    );
  } catch (err) {
    console.warn("buildPreviousDisplayMap: embedded query failed, skipping previousDisplay.", err);
    return empty;
  }
  console.log(`[PERF] buildPreviousDisplayMap Q1+Q2 merged: ${Date.now() - tPrev}ms | found=${historicalExercisesWithSets.length}`);

  if (historicalExercisesWithSets.length === 0) {
    return empty;
  }

  // ── Group sets by (exerciseId:exerciseType → sessionId → sets[]) ────────────
  // Outer key includes exerciseType so T1 Bench and T2 Bench are tracked
  // separately. GZCL T1/T2/T3 carry different weight/rep meanings, so mixing
  // tiers as "same exercise" would return the wrong previous values.
  // Within each (exercise, type) bucket, sessions remain isolated to prevent
  // cross-session set_number mixing.
  // deleted_at filtering is done in memory (PostgREST can't filter embedded child rows cleanly).
  type SessionSetEntry = {
    setNumber: number;
    weightKg: number | null;
    repsDone: number | null;
    startedAt: string;
  };
  const setsByExerciseTypeSession = new Map<string, Map<string, SessionSetEntry[]>>();

  for (const ex of historicalExercisesWithSets) {
    const startedAt = ex.workout_sessions?.started_at ?? "";
    const outerKey = `${ex.exercise_id}:${ex.exercise_type}`;

    if (!setsByExerciseTypeSession.has(outerKey)) {
      setsByExerciseTypeSession.set(outerKey, new Map());
    }
    const sessionMap = setsByExerciseTypeSession.get(outerKey)!;
    if (!sessionMap.has(ex.workout_session_id)) {
      sessionMap.set(ex.workout_session_id, []);
    }
    const sessionSets = sessionMap.get(ex.workout_session_id)!;

    for (const set of (ex.workout_sets ?? [])) {
      if (set.deleted_at !== null) continue;
      sessionSets.push({
        setNumber: set.set_number,
        weightKg: toNullableNumber(set.weight_kg),
        repsDone: set.reps_done,
        startedAt
      });
    }
  }

  // ── For each (exercise, type), pick the session with the latest startedAt ──
  const displayMap = new Map<string, string>();
  const previousSetsMap = new Map<string, PreviousSet[]>();

  for (const [outerKey, sessionMap] of setsByExerciseTypeSession.entries()) {
    let latestStartedAt = "";
    let latestSessionId = "";
    for (const [sessionId, sets] of sessionMap.entries()) {
      const startedAt = sets[0]?.startedAt ?? "";
      if (startedAt > latestStartedAt) {
        latestStartedAt = startedAt;
        latestSessionId = sessionId;
      }
    }

    const adoptedSets = (sessionMap.get(latestSessionId) ?? [])
      .slice()
      .sort((a, b) => a.setNumber - b.setNumber);

    const mappedSets: PreviousSet[] = adoptedSets.map((s, idx) => ({
      setNumber: idx + 1,
      weightKg: s.weightKg,
      repsDone: s.repsDone
    }));

    // Keys include exerciseType so buildExerciseBlocks can look up per-tier.
    previousSetsMap.set(outerKey, mappedSets);
    mappedSets.forEach((s) => {
      displayMap.set(`${outerKey}:${s.setNumber}`, formatPreviousDisplay(s.weightKg, s.repsDone));
    });

  }

  return { displayMap, previousSetsMap };
}

function buildExerciseBlocks(
  workoutSessionExercises: WorkoutSessionExerciseRow[],
  exercises: ExerciseRow[],
  workoutSets: WorkoutSetRow[],
  previousDisplayMap: Map<string, string>,
  previousSetsMap: Map<string, PreviousSet[]>,
  t1ProgressionHints: Map<string, T1ProgressionHint>,
  methodology: string | null
) {
  const exerciseMap = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const setsByExercise = new Map<string, WorkoutSetRow[]>();

  workoutSets.forEach((set) => {
    const group = setsByExercise.get(set.workout_session_exercise_id) ?? [];
    group.push(set);
    setsByExercise.set(set.workout_session_exercise_id, group);
  });

  return workoutSessionExercises.map<WorkoutExerciseBlock>((sessionExercise) => {
    const exercise = exerciseMap.get(sessionExercise.exercise_id);
    const visibleSets = (setsByExercise.get(sessionExercise.id) ?? []).map(
      (set, index) => {
        // Key: exerciseId:exerciseType:position — matches displayMap key strategy.
        // exerciseType ensures T1 and T2 of the same exercise get separate previous values.
        const previousKey = `${sessionExercise.exercise_id}:${sessionExercise.exercise_type}:${index + 1}`;

        return {
          id: set.id,
          setNumber: set.set_number,
          displaySetNumber: index + 1,
          targetRepsText: set.target_reps_text,
          weightKg: toNullableNumber(set.weight_kg),
          repsDone: set.reps_done,
          isCompleted: set.is_completed,
          isLocked: set.is_locked,
          completedAt: set.completed_at,
          isAutoFilled: set.is_auto_filled,
          note: set.note ?? "",
          previousDisplay: previousDisplayMap.get(previousKey) ?? "-",
          deletedAt: set.deleted_at
        };
      }
    );

    return {
      id: sessionExercise.id,
      exerciseId: sessionExercise.exercise_id,
      exerciseSlug: exercise?.slug ?? sessionExercise.exercise_id,
      exerciseNameJa: exercise?.name_ja ?? "Exercise",
      exerciseNameEn: exercise?.name_en ?? "Exercise",
      exerciseType: sessionExercise.exercise_type,
      orderIndex: sessionExercise.order_index,
      previousSets: previousSetsMap.get(`${sessionExercise.exercise_id}:${sessionExercise.exercise_type}`) ?? [],
      sets: visibleSets,
      wasAdded: sessionExercise.was_added,
      wasSwapped: sessionExercise.was_swapped,
      swapGroupSlug: sessionExercise.swap_group_slug ?? null,
      t1ProgressionHint: t1ProgressionHints.get(sessionExercise.exercise_id) ?? null,
      exerciseRoleLabel: resolveExerciseRoleLabel(sessionExercise.exercise_type, methodology)
    };
  });
}

function countIncompleteVisibleSets(workoutSets: WorkoutSetRow[]) {
  return workoutSets.filter((set) => set.is_completed === false).length;
}

/**
 * Shared: loads the full WorkoutSessionView for a given session row.
 * Called by both getCurrentWorkoutSessionView and findWorkoutSessionByDayId.
 */
async function loadSessionView(
  queryClient: DatabaseClient,
  session: WorkoutSessionRow
): Promise<WorkoutSessionView> {
  const t0 = Date.now();

  // Round 1: program_day+program_week (embedded join, one round trip) and session exercises
  // are independent — run in parallel.
  const [programDayWithWeek, workoutSessionExercises] = await Promise.all([
    selectProgramDayWithWeek(queryClient, session.program_day_id),
    selectWorkoutSessionExercises(queryClient, session.id)
  ]);
  const programWeek = programDayWithWeek?.program_weeks ?? null;
  console.log(`[PERF] loadSessionView round1 (programDayWithWeek+exercises): ${Date.now() - t0}ms`);

  // Round 2: exercises + sets (both depend on workoutSessionExercises from R1).
  // program_week is now available from the R1 embedded join — no extra round trip needed.
  const t1 = Date.now();
  const [exercises, workoutSets] = await Promise.all([
    selectExercises(queryClient, workoutSessionExercises.map((item) => item.exercise_id)),
    selectVisibleWorkoutSets(queryClient, workoutSessionExercises.map((item) => item.id))
  ]);
  console.log(`[PERF] loadSessionView round2 (exercises+sets): ${Date.now() - t1}ms`);

  // Round 3: program (depends on programWeek), previousDisplayMap + t1Hints (depend on
  // workoutSessionExercises + workoutSets) — all independent of each other, run in parallel.
  // buildPreviousDisplayMap itself has 2 sequential DB calls inside (historical exercises → historical sets).
  const t2 = Date.now();
  const t1ExerciseIds = workoutSessionExercises
    .filter((e) => e.exercise_type === "T1")
    .map((e) => e.exercise_id);

  const [program, { displayMap: previousDisplayMap, previousSetsMap }, t1ProgressionHints] = await Promise.all([
    selectProgram(queryClient, programWeek?.program_id ?? null),
    buildPreviousDisplayMap(queryClient, session, workoutSessionExercises, workoutSets),
    session.program_enrollment_id && t1ExerciseIds.length > 0
      ? selectT1ProgressionHints(queryClient, session.program_enrollment_id, t1ExerciseIds)
      : Promise.resolve(new Map<string, T1ProgressionHint>())
  ]);
  console.log(`[PERF] loadSessionView round3 (program+prevMap+t1hints): ${Date.now() - t2}ms`);
  console.log(`[PERF] loadSessionView TOTAL: ${Date.now() - t0}ms | exerciseCount=${workoutSessionExercises.length} setCount=${workoutSets.length}`);

  return {
    id: session.id,
    userId: session.user_id,
    programEnrollmentId: session.program_enrollment_id,
    programDayId: session.program_day_id,
    programTitle: session.program_day_id === null
      ? "自由作成ワークアウト"
      : (program?.title ?? "Current Program"),
    programWeekLabel: session.program_day_id === null
      ? ""
      : buildProgramWeekLabel(
          programWeek?.week_number ?? null,
          programWeek?.label ?? null,
          programDayWithWeek?.day_number ?? null
        ),
    progressionGuide:
      programDayWithWeek?.progression_guide ?? "Progression guide is not set yet.",
    notes:
      programDayWithWeek?.notes ?? "Train screen is reading active sets from Supabase.",
    startedAt: session.started_at,
    finishedAt: session.finished_at,
    status: session.status,
    incompleteSetCount: countIncompleteVisibleSets(workoutSets),
    exercises: buildExerciseBlocks(
      workoutSessionExercises,
      exercises,
      workoutSets,
      previousDisplayMap,
      previousSetsMap,
      t1ProgressionHints,
      session.program_day_id === null ? "custom" : (program?.methodology ?? null)
    )
  };
}

export async function getCurrentWorkoutSessionView(): Promise<WorkoutSessionView | null> {
  if (!hasSupabasePublicEnv()) {
    return getMockWorkoutSession();
  }

  try {
    const userId = await getAuthenticatedWorkoutUserId();

    if (!userId) {
      return null;
    }

    const queryClient = createWorkoutQueryClient();

    const session = await selectCurrentInProgressSession(queryClient, userId);

    if (!session) {
      return null;
    }

    return await loadSessionView(queryClient, session);
  } catch (error) {
    console.error("Failed to load train session from Supabase.", error);
    return null;
  }
}

/**
 * Finds an in_progress workout session for the given program_day_id.
 * Returns null when none exists — callers show a "Start Workout" screen instead.
 */
export async function findWorkoutSessionByDayId(
  programDayId: string
): Promise<WorkoutSessionView | null> {
  if (!hasSupabasePublicEnv()) return null;

  try {
    const userId = await getAuthenticatedWorkoutUserId();

    if (!userId) return null;

    const queryClient = createWorkoutQueryClient();

    const session = await selectSessionByDayId(queryClient, programDayId, userId);

    if (!session) return null;

    return await loadSessionView(queryClient, session);
  } catch (error) {
    console.error("Failed to find workout session by day id.", error);
    return null;
  }
}

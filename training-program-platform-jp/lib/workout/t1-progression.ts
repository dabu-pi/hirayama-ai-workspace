import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { T1ProgressionHint } from "@/types/workout";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type T1Phase = "5x3" | "6x2" | "10x1" | "retest_required";

type T1ProgressionRow = {
  exercise_id: string;
  phase: string;
  current_weight_kg: number | string;
};

type SetRow = {
  weight_kg: number | string | null;
  reps_done: number | null;
  is_completed: boolean;
  target_reps_text: string | null;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum reps for AMRAP success per phase. */
const PHASE_MIN_REPS: Record<Exclude<T1Phase, "retest_required">, number> = {
  "5x3": 3,
  "6x2": 2,
  "10x1": 1
};

/** Phase to advance to on fail. */
const PHASE_FAIL_NEXT: Record<Exclude<T1Phase, "retest_required">, T1Phase> = {
  "5x3": "6x2",
  "6x2": "10x1",
  "10x1": "retest_required"
};

/** Weight added per successful T1 session (kg). */
const WEIGHT_INCREMENT_KG = 2.5;

// ---------------------------------------------------------------------------
// Pure logic (exported for tests / future use)
// ---------------------------------------------------------------------------

/**
 * Determines pass/fail for the AMRAP (last) set of a T1 exercise.
 *
 * Success criteria:
 *   - set was completed (is_completed = true)
 *   - reps_done >= minimum for the phase
 *
 * Minimum is parsed from target_reps_text ("3+" → 3, "2+" → 2) when available,
 * otherwise falls back to PHASE_MIN_REPS[phase].
 */
export function determineAmrapResult(
  lastSet: Pick<SetRow, "is_completed" | "reps_done" | "target_reps_text">,
  phase: T1Phase
): "success" | "fail" {
  if (phase === "retest_required") return "fail";
  if (!lastSet.is_completed || lastSet.reps_done === null) return "fail";

  let minReps: number;
  if (lastSet.target_reps_text) {
    const match = lastSet.target_reps_text.match(/^(\d+)\+?$/);
    minReps = match ? parseInt(match[1], 10) : PHASE_MIN_REPS[phase];
  } else {
    minReps = PHASE_MIN_REPS[phase];
  }

  return lastSet.reps_done >= minReps ? "success" : "fail";
}

/**
 * Computes the next phase and weight recommendation after a session result.
 *
 * current_weight_kg = weight that was used as the basis (either the state's
 * stored recommendation, or the bootstrapped session weight for new states).
 * The returned current_weight_kg is the recommendation for the NEXT session.
 */
export function computeNextState(
  current: { phase: T1Phase; currentWeightKg: number },
  result: "success" | "fail"
): { phase: T1Phase; currentWeightKg: number } {
  if (current.phase === "retest_required") {
    return { phase: "retest_required", currentWeightKg: current.currentWeightKg };
  }
  if (result === "success") {
    return { phase: current.phase, currentWeightKg: current.currentWeightKg + WEIGHT_INCREMENT_KG };
  }
  return {
    phase: PHASE_FAIL_NEXT[current.phase],
    currentWeightKg: current.currentWeightKg
  };
}

/** Human-readable badge label for a T1 phase (e.g. "5x3" → "5×3+"). */
export function phaseBadgeLabel(phase: T1Phase): string {
  const labels: Record<T1Phase, string> = {
    "5x3": "5×3+",
    "6x2": "6×2+",
    "10x1": "10×1+",
    retest_required: "再テスト"
  };
  return labels[phase];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Infers a T1 phase from the number of sets in a session.
 * Used only when bootstrapping (no existing state row for this exercise).
 * 5 sets → 5x3, 6 sets → 6x2, ≥9 sets → 10x1.
 */
function inferPhaseFromSetCount(setCount: number): T1Phase {
  if (setCount >= 9) return "10x1";
  if (setCount >= 6) return "6x2";
  return "5x3";
}

// ---------------------------------------------------------------------------
// DB reads — used from train-session.ts (cookie client, RLS applies)
// ---------------------------------------------------------------------------

/**
 * Returns a map of exercise_id → T1ProgressionHint for the T1 exercises
 * in the given enrollment.
 *
 * Only exercises that already have a state row are included — the first
 * session has no hint (state is created on first finish).
 *
 * Silently returns empty map on error (non-blocking for session load).
 */
export async function selectT1ProgressionHints(
  client: SupabaseClient,
  enrollmentId: string,
  exerciseIds: string[]
): Promise<Map<string, T1ProgressionHint>> {
  if (exerciseIds.length === 0) return new Map();

  const { data, error } = await client
    .from("t1_progression_states")
    .select("exercise_id, phase, current_weight_kg")
    .eq("enrollment_id", enrollmentId)
    .in("exercise_id", exerciseIds);

  if (error) {
    console.warn("t1-progression: failed to load progression hints.", error.message);
    return new Map();
  }

  const result = new Map<string, T1ProgressionHint>();
  for (const row of (data ?? []) as T1ProgressionRow[]) {
    const phase = row.phase as T1Phase;
    result.set(row.exercise_id, {
      nextWeightKg: toNumber(row.current_weight_kg),
      phaseBadge: phaseBadgeLabel(phase)
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// DB writes — used from finish route (admin client, bypasses RLS)
// ---------------------------------------------------------------------------

/**
 * Called after a session is successfully marked as completed.
 *
 * For each T1 exercise in the session:
 *   1. Loads the session's non-deleted sets.
 *   2. Determines AMRAP result (last set pass/fail).
 *   3. Loads or bootstraps progression state for (enrollment_id, exercise_id).
 *   4. Computes next phase / weight and upserts the state.
 *
 * Silently returns on any error — session finish must never fail because of this.
 *
 * Called only on the primary completion path, not on S-4 idempotent re-finish,
 * to avoid double-advancing the weight.
 */
export async function updateT1ProgressionAfterSession(
  sessionId: string,
  userId: string,
  dbClient: SupabaseClient
): Promise<void> {
  try {
    // 1. Load session's enrollment
    const { data: session } = await dbClient
      .from("workout_sessions")
      .select("program_enrollment_id")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle<{ program_enrollment_id: string | null }>();

    if (!session?.program_enrollment_id) return;
    const enrollmentId = session.program_enrollment_id;

    // 2. Find T1 session exercises
    const { data: t1Exercises } = await dbClient
      .from("workout_session_exercises")
      .select("id, exercise_id")
      .eq("workout_session_id", sessionId)
      .eq("exercise_type", "T1");

    if (!t1Exercises || t1Exercises.length === 0) return;

    // 3. Process each T1 exercise
    for (const t1Ex of t1Exercises as Array<{ id: string; exercise_id: string }>) {
      await processT1Exercise(dbClient, enrollmentId, t1Ex.id, t1Ex.exercise_id);
    }
  } catch (error) {
    console.error("t1-progression: unexpected error in updateT1ProgressionAfterSession.", error);
  }
}

async function processT1Exercise(
  dbClient: SupabaseClient,
  enrollmentId: string,
  sessionExerciseId: string,
  exerciseId: string
): Promise<void> {
  // Load this exercise's sets (non-deleted, ascending)
  const { data: sets } = await dbClient
    .from("workout_sets")
    .select("weight_kg, reps_done, is_completed, target_reps_text")
    .eq("workout_session_exercise_id", sessionExerciseId)
    .is("deleted_at", null)
    .order("set_number", { ascending: true });

  if (!sets || sets.length === 0) return;

  const typedSets = sets as SetRow[];
  const lastSet = typedSets[typedSets.length - 1];

  // Load existing progression state for this enrollment + exercise
  const { data: existing } = await dbClient
    .from("t1_progression_states")
    .select("phase, current_weight_kg")
    .eq("enrollment_id", enrollmentId)
    .eq("exercise_id", exerciseId)
    .maybeSingle<{ phase: string; current_weight_kg: number | string }>();

  // Phase: use stored phase if exists, otherwise infer from set count (bootstrap)
  const currentPhase: T1Phase = existing
    ? (existing.phase as T1Phase)
    : inferPhaseFromSetCount(typedSets.length);

  // Weight basis:
  //   existing state  → use state's stored weight (the recommendation for this session)
  //   bootstrap       → use session's first set weight (seeds from what user actually did)
  const weightBasis = existing
    ? toNumber(existing.current_weight_kg)
    : toNumber(typedSets[0]?.weight_kg);

  const result = determineAmrapResult(lastSet, currentPhase);
  const next = computeNextState({ phase: currentPhase, currentWeightKg: weightBasis }, result);

  await dbClient
    .from("t1_progression_states")
    .upsert(
      {
        enrollment_id: enrollmentId,
        exercise_id: exerciseId,
        phase: next.phase,
        current_weight_kg: next.currentWeightKg,
        last_result: result,
        updated_at: new Date().toISOString()
      },
      { onConflict: "enrollment_id,exercise_id" }
    );
}

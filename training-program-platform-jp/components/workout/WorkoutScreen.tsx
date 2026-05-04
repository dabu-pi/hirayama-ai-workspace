"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import type {
  AddExerciseResponse,
  ExerciseListItem,
  SwapExerciseResponse,
  TrainProgramSelection,
  WorkoutExerciseBlock,
  WorkoutSessionCancelResponse,
  WorkoutSessionFinishResponse,
  WorkoutSet,
  WorkoutSessionStatus,
  WorkoutSessionView
} from "@/types/workout";

import { formatJstDateTime } from "@/lib/utils/date-jst";
import { formatWeekDay } from "@/lib/workout/format-labels";
import styles from "./WorkoutScreen.module.css";

type WorkoutScreenProps = {
  session: WorkoutSessionView;
  selectedProgram: TrainProgramSelection;
};

type SwipeState = {
  setId: string;
  startX: number;
};

type PendingMutation = {
  setId: string;
  kind: "delete" | "complete" | "unlock";
} | null;

type SetDraft = {
  weightKg: string;
  repsDone: string;
};

type SetDraftMap = Record<string, SetDraft>;

type SessionMetaState = {
  id: string;
  status: WorkoutSessionStatus;
  finishedAt: string | null;
  incompleteSetCount: number;
};

type FailedAction = "cancel" | null;

type SetMutationResponse = {
  id: string;
  weightKg?: number | null;
  repsDone?: number | null;
  isAutoFilled?: boolean;
  isCompleted?: boolean;
  isLocked?: boolean;
  completedAt?: string | null;
  deletedAt?: string | null;
};

type AddSetResponse = {
  id: string;
  workoutSessionExerciseId: string;
  setNumber: number;
  targetRepsText: string | null;
  weightKg: number | null;
  repsDone: number | null;
  isCompleted: boolean;
  isLocked: boolean;
  completedAt: string | null;
  isAutoFilled: boolean;
  previousDisplay: string;
  deletedAt: string | null;
};

/** Client-side equivalent of server formatPreviousDisplay — uses same format string. */
function formatPrevDisplay(prev: { weightKg: number | null; repsDone: number | null } | null | undefined): string {
  if (!prev) return "-";
  if (prev.weightKg !== null && prev.repsDone !== null) return `${prev.weightKg}kg x ${prev.repsDone}`;
  if (prev.weightKg !== null) return `${prev.weightKg}kg`;
  if (prev.repsDone !== null) return `x ${prev.repsDone}`;
  return "-";
}

/** Returns a single-line suggestion based on how all sets trend vs previous session. */
function getExerciseSuggestion(
  exercise: WorkoutExerciseBlock,
  draftInputs: SetDraftMap
): { text: string; positive: boolean } | null {
  let anyDecline = false;
  let anyProgress = false;
  let anyComparable = false;

  exercise.sets.forEach((set, i) => {
    const prevSet = exercise.previousSets[i] ?? null;
    const draft = getSetDraft(draftInputs, set);
    const { weightDiff, repsDiff } = calcSetDiff(draft, prevSet);
    if (weightDiff === null && repsDiff === null) return;
    anyComparable = true;
    if ((weightDiff !== null && weightDiff < 0) || (repsDiff !== null && repsDiff < 0)) anyDecline = true;
    if ((weightDiff !== null && weightDiff > 0) || (repsDiff !== null && repsDiff > 0)) anyProgress = true;
  });

  if (!anyComparable) return null;
  if (anyDecline) return { text: "まずは同じ重量で安定させましょう", positive: false };
  if (anyProgress) return { text: "フォームが安定していれば、次回は +2.5kg もおすすめです", positive: true };
  return null;
}

/** Calculates per-set diff between current draft inputs and previous session values. */
function calcSetDiff(
  draft: { weightKg: string; repsDone: string },
  prevSet: { weightKg: number | null; repsDone: number | null } | null
): { weightDiff: number | null; repsDiff: number | null } {
  if (!prevSet) return { weightDiff: null, repsDiff: null };
  const currentWeight = draft.weightKg !== "" ? parseFloat(draft.weightKg) : null;
  const currentReps = draft.repsDone !== "" ? parseInt(draft.repsDone, 10) : null;
  return {
    weightDiff:
      currentWeight !== null && !isNaN(currentWeight) && prevSet.weightKg !== null
        ? Math.round((currentWeight - prevSet.weightKg) * 10) / 10
        : null,
    repsDiff:
      currentReps !== null && !isNaN(currentReps) && prevSet.repsDone !== null
        ? currentReps - prevSet.repsDone
        : null
  };
}

type SetEvalVariant = "positive" | "neutral" | "negative";
type SetEvalLabel = { text: string; variant: SetEvalVariant };

/** Returns a per-set evaluation label based on diff vs previous session. */
function getSetEvalLabel(
  weightDiff: number | null,
  repsDiff: number | null,
  hasPrev: boolean
): SetEvalLabel | null {
  if (!hasPrev) return null;
  if (weightDiff === null && repsDiff === null) return null;
  const isNegative = (weightDiff !== null && weightDiff < 0) || (repsDiff !== null && repsDiff < 0);
  const isPositive = !isNegative && ((weightDiff !== null && weightDiff > 0) || (repsDiff !== null && repsDiff > 0));
  if (isPositive) return { text: "前回より良い", variant: "positive" };
  if (isNegative) return { text: "少し下がっています", variant: "negative" };
  return { text: "同じくらい", variant: "neutral" };
}

function typeClassName(exerciseType: "T1" | "T2" | "T3") {
  if (exerciseType === "T1") return `${styles.typeBadge} ${styles.typeT1}`;
  if (exerciseType === "T2") return `${styles.typeBadge} ${styles.typeT2}`;
  return `${styles.typeBadge} ${styles.typeT3}`;
}

function stringifyNumber(value: number | null) {
  return value === null ? "" : String(value);
}

/**
 * Parses the leading integer from a target_reps_text string.
 * "3+"  → 3
 * "10"  → 10
 * "15+" → 15
 * "8-10"→ 8 (lower bound)
 * null / unparseable → null
 */
function parseTargetReps(targetRepsText: string | null | undefined): number | null {
  if (!targetRepsText) return null;
  const match = targetRepsText.match(/^(\d+)/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Default reps initial value for a set:
 *   1. repsDone already set (resuming session) → use it
 *   2. targetRepsText has a parseable number → use it
 *   3. fallback → "10"
 */
function defaultRepsDraft(
  repsDone: number | null,
  targetRepsText: string | null | undefined
): string {
  if (repsDone !== null) return stringifyNumber(repsDone);
  const fromTarget = parseTargetReps(targetRepsText);
  return fromTarget !== null ? String(fromTarget) : "10";
}

function buildDraftInputs(exercises: WorkoutExerciseBlock[]) {
  return exercises.reduce<SetDraftMap>((accumulator, exercise) => {
    exercise.sets.forEach((set, setIndex) => {
      const prevWeight = exercise.previousSets[setIndex]?.weightKg ?? null;
      accumulator[set.id] = {
        weightKg: set.weightKg !== null ? stringifyNumber(set.weightKg) : stringifyNumber(prevWeight),
        repsDone: defaultRepsDraft(set.repsDone, set.targetRepsText)
      };
    });
    return accumulator;
  }, {});
}

/** Formats rest-timer seconds as M:SS. 0 returns "完了!". */
function formatRestTime(seconds: number): string {
  if (seconds === 0) return "完了!";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Epley 式による推定 1RM 計算 (UI補助のみ。DB保存しない)。
 * 1RM = 重量 × (1 + 回数 / 30)
 */
type Calc1RMResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

function compute1RM(weightStr: string, repsStr: string): Calc1RMResult {
  const w = parseFloat(weightStr);
  const r = parseInt(repsStr, 10);
  if (!weightStr.trim() || !repsStr.trim() || isNaN(w) || isNaN(r)) {
    return { ok: false, error: "重量と回数を入力してください。" };
  }
  if (w <= 0 || r <= 0) {
    return { ok: false, error: "重量と回数は1以上の数値を入力してください。" };
  }
  return { ok: true, value: Math.round(w * (1 + r / 30) * 10) / 10 };
}

/** Formats elapsed seconds as MM:SS or H:MM:SS. */
function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function withDisplaySetNumbers(exercises: WorkoutExerciseBlock[]) {
  return exercises.map((exercise) => ({
    ...exercise,
    sets: exercise.sets
      .filter((set) => set.deletedAt === null)
      .sort((left, right) => left.setNumber - right.setNumber)
      .map((set, index) => ({
        ...set,
        displaySetNumber: index + 1
      }))
  }));
}

function buildInitialExercises(session: WorkoutSessionView) {
  return withDisplaySetNumbers(session.exercises);
}

function updateExerciseState(
  exercises: WorkoutExerciseBlock[],
  exerciseId: string,
  updater: (exercise: WorkoutExerciseBlock) => WorkoutExerciseBlock
) {
  return withDisplaySetNumbers(
    exercises.map((exercise) =>
      exercise.id === exerciseId ? updater(exercise) : exercise
    )
  );
}

function parseWeightKg(rawValue: string) {
  const trimmed = rawValue.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error("Kg は数値で入力してください。");
  }
  return parsed;
}

function parseRepsDone(rawValue: string) {
  const trimmed = rawValue.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) {
    throw new Error("Reps は整数で入力してください。");
  }
  return parsed;
}

async function postSetAction(
  setId: string,
  action: "delete" | "complete" | "unlock"
) {
  const response = await fetch(`/api/workout-sets/${setId}/${action}`, {
    method: "POST"
  });
  const payload = (await response.json().catch(() => null)) as
    | SetMutationResponse
    | { error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "error" in payload && payload.error?.message
        ? payload.error.message
        : "セット操作に失敗しました。"
    );
  }

  return payload as SetMutationResponse;
}

/**
 * Complete a set and atomically save the current weight / reps at the same time.
 * Sending values here removes the dependency on a prior onBlur save.
 */
async function postCompleteSet(
  setId: string,
  body: { weightKg: number | null; repsDone: number | null }
) {
  const response = await fetch(`/api/workout-sets/${setId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => null)) as
    | SetMutationResponse
    | { error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(
      payload && "error" in payload && payload.error?.message
        ? payload.error.message
        : "セット完了に失敗しました。"
    );
  }
  return payload as SetMutationResponse;
}

async function patchWorkoutSet(
  setId: string,
  payload: { weightKg: number | null; repsDone: number | null; isAutoFilled: boolean }
) {
  const response = await fetch(`/api/workout-sets/${setId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = (await response.json().catch(() => null)) as
    | SetMutationResponse
    | { error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(
      body && "error" in body && body.error?.message
        ? body.error.message
        : "入力保存に失敗しました。"
    );
  }

  return body as SetMutationResponse;
}

async function postAddSet(workoutSessionExerciseId: string) {
  const response = await fetch(
    `/api/workout-session-exercises/${workoutSessionExerciseId}/sets`,
    { method: "POST" }
  );
  const payload = (await response.json().catch(() => null)) as
    | AddSetResponse
    | { error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "error" in payload && payload.error?.message
        ? payload.error.message
        : "Add Set に失敗しました。"
    );
  }

  return payload as AddSetResponse;
}

async function postFinishSession(sessionId: string, forceFinish: boolean) {
  const response = await fetch(`/api/workout-sessions/${sessionId}/finish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ forceFinish })
  });
  const payload = (await response.json().catch(() => null)) as
    | WorkoutSessionFinishResponse
    | { error?: { message?: string } }
    | null;

  if (response.status === 409 && payload && "requiresConfirmation" in payload) {
    return payload as WorkoutSessionFinishResponse;
  }

  if (!response.ok) {
    throw new Error(
      payload && "error" in payload && payload.error?.message
        ? payload.error.message
        : "Finish に失敗しました。"
    );
  }

  return payload as WorkoutSessionFinishResponse;
}

async function postCancelSession(sessionId: string): Promise<WorkoutSessionCancelResponse> {
  const response = await fetch(`/api/workout-sessions/${sessionId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  const payload = (await response.json().catch(() => null)) as
    | WorkoutSessionCancelResponse
    | { error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "error" in payload && payload.error?.message
        ? payload.error.message
        : "Cancel に失敗しました。"
    );
  }

  return payload as WorkoutSessionCancelResponse;
}

async function postAddExercise(
  sessionId: string,
  exerciseId: string,
  source: "library" | "user" = "library"
) {
  const body =
    source === "user"
      ? { user_exercise_id: exerciseId }
      : { exercise_id: exerciseId };
  const response = await fetch(`/api/workout-sessions/${sessionId}/exercises`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => null)) as
    | AddExerciseResponse
    | { error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "error" in payload && payload.error?.message
        ? payload.error.message
        : "Add Exercise に失敗しました。"
    );
  }

  return payload as AddExerciseResponse;
}


async function postSwapExercise(
  sessionId: string,
  sessionExerciseId: string,
  newExerciseId: string,
  source: "library" | "user" = "library"
) {
  const body =
    source === "user"
      ? { user_exercise_id: newExerciseId }
      : { exercise_id: newExerciseId };
  const response = await fetch(
    `/api/workout-sessions/${sessionId}/exercises/${sessionExerciseId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );
  const payload = (await response.json().catch(() => null)) as
    | SwapExerciseResponse
    | { error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "error" in payload && payload.error?.message
        ? payload.error.message
        : "Swap に失敗しました。"
    );
  }

  return payload as SwapExerciseResponse;
}

function getSetDraft(draftInputs: SetDraftMap, set: WorkoutSet): SetDraft {
  return (
    draftInputs[set.id] ?? {
      weightKg: stringifyNumber(set.weightKg),
      repsDone: stringifyNumber(set.repsDone)
    }
  );
}

function formatFinishedAt(value: string | null) {
  if (!value) return "完了日時は未記録";
  const formatted = formatJstDateTime(value);
  if (formatted === "記録なし") return "完了日時は未記録";
  return `完了日時: ${formatted}`;
}

function formatProgramSourceLabel(source: TrainProgramSelection["source"]) {
  if (source === "supabase") return "Supabase";
  if (source === "mock_catalog") return "mock catalog";
  return "unknown";
}

/**
 * Plays a short beep — used for countdown ticks (残り3/2/1秒).
 * Fails silently if unavailable — audio is non-critical.
 */
function playBeep(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  volume: number
): void {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Silently ignore
  }
}

/**
 * Plays a bell-like chime using 3 stacked oscillators — used for timer end (「チーン」).
 * Quick attack + gradual decay to avoid clicks.
 * Fails silently if unavailable.
 */
function playBellChime(ctx: AudioContext, volume: number): void {
  const freqs = [880, 1320, 1760];
  const duration = 0.6;
  for (const freq of freqs) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      // Quick attack, then gradual exponential decay for bell character
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Silently ignore
    }
  }
}

export function WorkoutScreen({
  session,
  selectedProgram
}: WorkoutScreenProps) {
  const router = useRouter();
  const swipeRef = useRef<SwipeState | null>(null);
  const kgInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [exercises, setExercises] = useState<WorkoutExerciseBlock[]>(() =>
    buildInitialExercises(session)
  );
  const [draftInputs, setDraftInputs] = useState<SetDraftMap>(() =>
    buildDraftInputs(buildInitialExercises(session))
  );
  const [sessionMeta, setSessionMeta] = useState<SessionMetaState>({
    id: session.id,
    status: session.status,
    finishedAt: session.finishedAt,
    incompleteSetCount: session.incompleteSetCount
  });
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => {
    const startedAt = new Date(session.startedAt).getTime();
    return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  });
  const [revealedSetId, setRevealedSetId] = useState<string | null>(null);
  const [pendingMutation, setPendingMutation] = useState<PendingMutation>(null);
  const [pendingAddExerciseId, setPendingAddExerciseId] = useState<string | null>(null);
  const [savingSetIds, setSavingSetIds] = useState<string[]>([]);
  // Per-set lock for complete / uncomplete operations.
  // Replaces the global pendingMutation lock for these actions so that
  // different sets can be completed concurrently.
  const [completingSetIds, setCompletingSetIds] = useState<string[]>([]);
  const [focusSetId, setFocusSetId] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedAction, setFailedAction] = useState<FailedAction>(null);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const REST_DEFAULT_SEC = 90;
  const REST_MIN_SEC = 15;
  const REST_MAX_SEC = 600;
  const REST_DURATION_KEY = "restTimerDuration";
  const REST_DURATION_PRESETS = [60, 90, 120, 180] as const;

  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const restEndTimeRef = useRef<number | null>(null);
  const restDoneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [restDurationSec, setRestDurationSec] = useState<number>(() => {
    if (typeof window === "undefined") return REST_DEFAULT_SEC;
    const stored = parseInt(localStorage.getItem(REST_DURATION_KEY) ?? "", 10);
    return !isNaN(stored) && stored >= REST_MIN_SEC && stored <= REST_MAX_SEC
      ? stored
      : REST_DEFAULT_SEC;
  });
  const restDurationSecRef = useRef(restDurationSec);
  restDurationSecRef.current = restDurationSec;

  // Timer notification sound
  const [timerSoundEnabled, setTimerSoundEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("restTimerSound") !== "off";
  });
  // Ref keeps the interval closure in sync with current state (avoids stale closure).
  const timerSoundEnabledRef = useRef(timerSoundEnabled);
  timerSoundEnabledRef.current = timerSoundEnabled;
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Track which second has already been beeped to prevent double-fire at 250ms polling.
  const lastBeepedSecRef = useRef<number | null>(null);

  // Add Exercise / Swap modal
  const [isAddExerciseModalOpen, setIsAddExerciseModalOpen] = useState(false);
  const [exerciseModalMode, setExerciseModalMode] = useState<"add" | "swap">("add");
  const [swapTargetBlockId, setSwapTargetBlockId] = useState<string | null>(null);
  const [swapGroupSlug, setSwapGroupSlug] = useState<string | null>(null);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [exerciseList, setExerciseList] = useState<ExerciseListItem[]>([]);
  const [isLoadingExercises, setIsLoadingExercises] = useState(false);
  const [isAddingExerciseId, setIsAddingExerciseId] = useState<string | null>(null);
  const [addExerciseError, setAddExerciseError] = useState<string | null>(null);
  const [scrollToExerciseId, setScrollToExerciseId] = useState<string | null>(null);
  const exerciseBlockRefs = useRef<Record<string, HTMLElement | null>>({});

  // Create custom exercise (in add modal)
  const [isCreateExerciseMode, setIsCreateExerciseMode] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseCategory, setNewExerciseCategory] = useState("");
  const [isCreatingExercise, setIsCreatingExercise] = useState(false);

  // 1RM calculator modal state
  const [is1RMModalOpen, setIs1RMModalOpen] = useState(false);
  const [calc1RMWeight, setCalc1RMWeight] = useState("");
  const [calc1RMReps, setCalc1RMReps] = useState("");

  const clearRestDoneTimeout = () => {
    if (restDoneTimeoutRef.current !== null) {
      clearTimeout(restDoneTimeoutRef.current);
      restDoneTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    const nextExercises = buildInitialExercises(session);
    setExercises(nextExercises);
    setDraftInputs(buildDraftInputs(nextExercises));
    setSessionMeta({
      id: session.id,
      status: session.status,
      finishedAt: session.finishedAt,
      incompleteSetCount: session.incompleteSetCount
    });
    setRevealedSetId(null);
    setFailedAction(null);
    setErrorMessage(null);
    restEndTimeRef.current = null;
    lastBeepedSecRef.current = null;
    clearRestDoneTimeout();
    setRestSecondsLeft(null);
  }, [session]);

  useEffect(() => {
    if (!focusSetId) return;
    const nextInput = kgInputRefs.current[focusSetId];
    if (nextInput) {
      nextInput.focus();
      setFocusSetId(null);
    }
  }, [focusSetId, exercises]);

  // 新規追加ブロックへスクロールし、最初の Kg 入力にフォーカス
  useEffect(() => {
    if (!scrollToExerciseId) return;
    const element = exerciseBlockRefs.current[scrollToExerciseId];
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    const firstKgInput = element.querySelector(
      "input[inputmode='decimal']"
    ) as HTMLInputElement | null;
    if (firstKgInput) firstKgInput.focus();
    setScrollToExerciseId(null);
  }, [scrollToExerciseId, exercises]);

  // Tick the elapsed timer once per second while the session is in progress.
  useEffect(() => {
    const startedAt = new Date(session.startedAt).getTime();
    const tick = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session.startedAt]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (restEndTimeRef.current === null) return;
      const remaining = Math.max(0, Math.ceil((restEndTimeRef.current - Date.now()) / 1000));

      // Notification beep: fire once per second at countdown 3-2-1 and at end (0).
      // lastBeepedSecRef prevents double-fire from 250ms polling.
      if (remaining <= 3 && remaining !== lastBeepedSecRef.current) {
        lastBeepedSecRef.current = remaining;
        if (timerSoundEnabledRef.current) {
          try {
            if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
              audioCtxRef.current = new (
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext })
                  .webkitAudioContext
              )();
            }
            const ctx = audioCtxRef.current;
            if (ctx.state === "running") {
              if (remaining === 0) {
                // End: bell chime (「チーン」) — 880/1320/1760Hz stacked, 0.6s
                playBellChime(ctx, 0.045);
              } else {
                // Countdown tick (「ピッ」) — 880Hz, 0.07s
                playBeep(ctx, 880, 0.07, 0.04);
              }
            }
          } catch {
            // Audio unavailable — timer continues normally
          }
        }
      }

      if (remaining === 0) {
        restEndTimeRef.current = null;
        setRestSecondsLeft(0);
        clearRestDoneTimeout();
        restDoneTimeoutRef.current = setTimeout(() => {
          restDoneTimeoutRef.current = null;
          setRestSecondsLeft(null);
        }, 2500);
      } else {
        setRestSecondsLeft(remaining);
      }
    }, 250);

    return () => {
      clearInterval(interval);
      clearRestDoneTimeout();
    };
  }, []);

  const applyRestDuration = (sec: number) => {
    const clamped = Math.min(REST_MAX_SEC, Math.max(REST_MIN_SEC, sec));
    setRestDurationSec(clamped);
    restDurationSecRef.current = clamped;
    if (typeof window !== "undefined") {
      localStorage.setItem(REST_DURATION_KEY, String(clamped));
    }
  };

  const startRestTimer = () => {
    clearRestDoneTimeout();
    lastBeepedSecRef.current = null;
    const dur = restDurationSecRef.current;
    restEndTimeRef.current = Date.now() + dur * 1000;
    setRestSecondsLeft(dur);
  };

  const handleRestTimer = () => {
    if (restEndTimeRef.current !== null) {
      clearRestDoneTimeout();
      restEndTimeRef.current = null;
      lastBeepedSecRef.current = null;
      setRestSecondsLeft(null);
      return;
    }
    startRestTimer();
  };

  const isSessionCompleted = sessionMeta.status === "completed";
  const isSessionCancelled = sessionMeta.status === "cancelled";
  /** True when session is no longer editable (completed or cancelled). */
  const isSessionEnded = isSessionCompleted || isSessionCancelled;
  const showCancelRecoveryActions = failedAction === "cancel" && !isSessionEnded;

  const refreshTrainScreen = () => {
    startRefreshTransition(() => router.refresh());
  };

  const updateIncompleteSetCount = (delta: number) => {
    setSessionMeta((current) => ({
      ...current,
      incompleteSetCount: Math.max(0, current.incompleteSetCount + delta)
    }));
  };

  const applyFinishedState = (payload: WorkoutSessionFinishResponse) => {
    setSessionMeta((current) => ({
      ...current,
      status: payload.status,
      finishedAt: payload.finishedAt,
      incompleteSetCount: payload.incompleteSetCount
    }));
  };

  const markSaving = (setId: string) => {
    setSavingSetIds((current) => (current.includes(setId) ? current : [...current, setId]));
  };

  const clearSaving = (setId: string) => {
    setSavingSetIds((current) => current.filter((item) => item !== setId));
  };

  const clearTransientError = () => {
    setErrorMessage(null);
    setFailedAction(null);
  };

  /**
   * Clicking the Target reps cell fills the repsDone input with the parsed
   * target value. This is a quick-fill convenience, especially for GZCL
   * where the target is "3+" / "10" / "15+".
   */
  const handleFillFromTarget = (
    exerciseId: string,
    setId: string,
    targetRepsText: string | null | undefined
  ) => {
    if (isSessionEnded) return;
    const exercise = exercises.find((item) => item.id === exerciseId);
    const targetSet = exercise?.sets.find((item) => item.id === setId);
    if (!exercise || !targetSet) return;

    const parsed = parseTargetReps(targetRepsText);
    if (parsed === null) return;

    setDraftInputs((current) => ({
      ...current,
      [setId]: { ...getSetDraft(current, targetSet), repsDone: String(parsed) }
    }));
    clearTransientError();
  };

  const handleSwipeStart = (setId: string, clientX: number) => {
    if (isSessionEnded) return;
    swipeRef.current = { setId, startX: clientX };
  };

  const handleSwipeEnd = (setId: string, clientX: number) => {
    if (isSessionEnded || !swipeRef.current) return;
    const deltaX = clientX - swipeRef.current.startX;
    if (deltaX <= -40) setRevealedSetId(setId);
    if (deltaX >= 20 && revealedSetId === setId) setRevealedSetId(null);
    if (revealedSetId && revealedSetId !== setId) setRevealedSetId(null);
    swipeRef.current = null;
  };

  const handleInputChange = (
    exerciseId: string,
    setId: string,
    field: "weightKg" | "repsDone",
    nextValue: string
  ) => {
    if (isSessionEnded) return;
    const exercise = exercises.find((item) => item.id === exerciseId);
    const targetSet = exercise?.sets.find((item) => item.id === setId);
    if (!exercise || !targetSet) return;

    clearTransientError();
    // Propagate weight to subsequent incomplete sets when typing in any set's weight field.
    // Candidates must be: (a) after the edited set by setNumber, (b) not yet completed,
    // (c) either empty or auto-filled (= not hand-typed by the user).
    const shouldReflectWeight = field === "weightKg" && nextValue.trim() !== "";

    const reflectedSetIds = shouldReflectWeight
      ? exercise.sets
          .filter(
            (candidate) =>
              candidate.id !== setId &&
              !candidate.isCompleted &&
              candidate.setNumber > targetSet.setNumber
          )
          .filter((candidate) => {
            const candidateDraft = getSetDraft(draftInputs, candidate);
            return candidateDraft.weightKg.trim() === "" || candidate.isAutoFilled;
          })
          .map((candidate) => candidate.id)
      : [];

    setDraftInputs((current) => {
      const nextDrafts = {
        ...current,
        [setId]: { ...getSetDraft(current, targetSet), [field]: nextValue }
      };

      reflectedSetIds.forEach((candidateId) => {
        const candidate = exercise.sets.find((item) => item.id === candidateId);
        if (!candidate) return;
        nextDrafts[candidateId] = {
          ...getSetDraft(nextDrafts, candidate),
          weightKg: nextValue
        };
      });

      return nextDrafts;
    });

    // Skip exercises state update when nothing would actually change:
    // - setId's isAutoFilled is already false (most keystrokes on Set 2+)
    // - no sets are being newly reflected
    const needsAutoFilledUpdate = targetSet.isAutoFilled || reflectedSetIds.length > 0;
    if (needsAutoFilledUpdate) {
      setExercises((current) =>
        updateExerciseState(current, exerciseId, (exerciseItem) => ({
          ...exerciseItem,
          sets: exerciseItem.sets.map((set) => {
            if (set.id === setId) return { ...set, isAutoFilled: false };
            if (reflectedSetIds.includes(set.id)) return { ...set, isAutoFilled: true };
            return set;
          })
        }))
      );
    }
  };

  const handleInputSave = async (exerciseId: string, setId: string) => {
    const exercise = exercises.find((item) => item.id === exerciseId);
    const targetSet = exercise?.sets.find((item) => item.id === setId);
    if (
      isSessionEnded ||
      !exercise ||
      !targetSet ||
      savingSetIds.includes(setId)
    ) {
      return;
    }

    const draft = getSetDraft(draftInputs, targetSet);

    try {
      const parsedWeightKg = parseWeightKg(draft.weightKg);
      const parsedRepsDone = parseRepsDone(draft.repsDone);
      setDraftInputs((current) => ({
        ...current,
        [setId]: {
          weightKg: stringifyNumber(parsedWeightKg),
          repsDone: stringifyNumber(parsedRepsDone)
        }
      }));

      if (
        parsedWeightKg === targetSet.weightKg &&
        parsedRepsDone === targetSet.repsDone
      ) {
        return;
      }

      setErrorMessage(null);
      markSaving(setId);
      const payload = await patchWorkoutSet(setId, {
        weightKg: parsedWeightKg,
        repsDone: parsedRepsDone,
        isAutoFilled: targetSet.isAutoFilled
      });

      setExercises((current) =>
        updateExerciseState(current, exerciseId, (exerciseItem) => ({
          ...exerciseItem,
          sets: exerciseItem.sets.map((set) =>
            set.id === setId
              ? {
                  ...set,
                  weightKg: payload.weightKg ?? null,
                  repsDone: payload.repsDone ?? null,
                  isAutoFilled: payload.isAutoFilled ?? set.isAutoFilled,
                  deletedAt: payload.deletedAt ?? set.deletedAt
                }
              : set
          )
        }))
      );
    } catch (error) {
      console.error("Failed to save workout set input.", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "入力保存に失敗しました。入力値は画面に残るので、再度保存できます。"
      );
    } finally {
      clearSaving(setId);
    }
  };

  const handleAddSet = async (exerciseId: string) => {
    if (isSessionEnded || pendingAddExerciseId || pendingMutation || isFinishing) return;
    setPendingAddExerciseId(exerciseId);
    clearTransientError();

    try {
      const payload = await postAddSet(exerciseId);
      const newSet: WorkoutSet = {
        id: payload.id,
        setNumber: payload.setNumber,
        displaySetNumber: 0,
        targetRepsText: payload.targetRepsText,
        weightKg: payload.weightKg,
        repsDone: payload.repsDone,
        isCompleted: payload.isCompleted,
        isLocked: payload.isLocked,
        completedAt: payload.completedAt,
        isAutoFilled: payload.isAutoFilled,
        note: "",
        previousDisplay: payload.previousDisplay,
        deletedAt: payload.deletedAt
      };

      setExercises((current) =>
        updateExerciseState(current, exerciseId, (exerciseItem) => ({
          ...exerciseItem,
          sets: [...exerciseItem.sets, newSet]
        }))
      );
      setDraftInputs((current) => ({
        ...current,
        [newSet.id]: {
          weightKg: "",
          repsDone: defaultRepsDraft(null, newSet.targetRepsText)
        }
      }));
      updateIncompleteSetCount(1);
      setFocusSetId(newSet.id);
    } catch (error) {
      console.error("Failed to add workout set.", error);
      setErrorMessage(error instanceof Error ? error.message : "Add Set に失敗しました。");
    } finally {
      setPendingAddExerciseId(null);
    }
  };

  const handleDelete = async (exerciseId: string, setId: string) => {
    const exercise = exercises.find((item) => item.id === exerciseId);
    const targetSet = exercise?.sets.find((item) => item.id === setId);
    if (
      isSessionEnded ||
      !exercise ||
      !targetSet ||
      pendingMutation ||
      isFinishing
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Set ${targetSet.displaySetNumber} を削除しますか。削除したセットは表示から消えます。`
    );
    if (!confirmed) return;

    setPendingMutation({ setId, kind: "delete" });
    clearTransientError();

    try {
      await postSetAction(setId, "delete");
      setExercises((current) =>
        updateExerciseState(current, exerciseId, (exerciseItem) => ({
          ...exerciseItem,
          sets: exerciseItem.sets.filter((set) => set.id !== setId)
        }))
      );
      setDraftInputs((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[setId];
        return nextDrafts;
      });
      if (!targetSet.isCompleted) updateIncompleteSetCount(-1);
      setRevealedSetId(null);
    } catch (error) {
      console.error("Failed to delete workout set.", error);
      setErrorMessage(error instanceof Error ? error.message : "セット削除に失敗しました。");
    } finally {
      setPendingMutation(null);
    }
  };

  const handleComplete = async (exerciseId: string, setId: string) => {
    // Per-set lock: only block if THIS set is already completing.
    // No global pendingMutation check — other sets can complete concurrently.
    // No savingSetIds check — we send weight/reps directly in the complete payload.
    if (isSessionEnded || completingSetIds.includes(setId) || isFinishing) {
      return;
    }

    const prevSet = exercises
      .find((exercise) => exercise.id === exerciseId)
      ?.sets.find((set) => set.id === setId);

    if (!prevSet) return;

    // Capture the current draft values to send atomically with complete.
    // This removes the dependency on a prior onBlur save.
    const draft = getSetDraft(draftInputs, prevSet);
    const parsedWeightKg = parseWeightKg(draft.weightKg);
    const parsedRepsDone = parseRepsDone(draft.repsDone);

    const optimisticCompletedAt = new Date().toISOString();

    // Optimistic update — UI reflects complete immediately.
    setExercises((current) =>
      updateExerciseState(current, exerciseId, (exerciseItem) => ({
        ...exerciseItem,
        sets: exerciseItem.sets.map((set) =>
          set.id === setId
            ? {
                ...set,
                isCompleted: true,
                isLocked: false,
                completedAt: optimisticCompletedAt
              }
            : set
        )
      }))
    );
    setRevealedSetId((current) => (current === setId ? null : current));
    updateIncompleteSetCount(-1);
    setCompletingSetIds((current) => [...current, setId]);
    clearTransientError();
    startRestTimer();

    try {
      // Send weight/reps together with complete in a single request.
      const payload = await postCompleteSet(setId, {
        weightKg: parsedWeightKg,
        repsDone: parsedRepsDone
      });

      // Sync server-confirmed state and saved values.
      setExercises((current) =>
        updateExerciseState(current, exerciseId, (exerciseItem) => ({
          ...exerciseItem,
          sets: exerciseItem.sets.map((set) =>
            set.id === setId
              ? {
                  ...set,
                  isCompleted: payload.isCompleted ?? true,
                  isLocked: payload.isLocked ?? false,
                  completedAt: payload.completedAt ?? optimisticCompletedAt,
                  weightKg: parsedWeightKg,
                  repsDone: parsedRepsDone
                }
              : set
          )
        }))
      );
      // Normalize draft to match saved values (clears any partially-typed input).
      setDraftInputs((current) => ({
        ...current,
        [setId]: {
          weightKg: stringifyNumber(parsedWeightKg),
          repsDone: stringifyNumber(parsedRepsDone)
        }
      }));
    } catch (error) {
      console.error("Failed to complete workout set.", error);
      setExercises((current) =>
        updateExerciseState(current, exerciseId, (exerciseItem) => ({
          ...exerciseItem,
          sets: exerciseItem.sets.map((set) =>
            set.id === setId
              ? {
                  ...set,
                  isCompleted: prevSet.isCompleted,
                  isLocked: prevSet.isLocked,
                  completedAt: prevSet.completedAt
                }
              : set
          )
        }))
      );
      updateIncompleteSetCount(1);
      setErrorMessage(error instanceof Error ? error.message : "セット完了に失敗しました。");
      restEndTimeRef.current = null;
      clearRestDoneTimeout();
      setRestSecondsLeft(null);
    } finally {
      setCompletingSetIds((current) => current.filter((id) => id !== setId));
    }
  };

  const handleUncomplete = async (exerciseId: string, setId: string) => {
    // Per-set lock — mirror handleComplete's guard.
    if (isSessionEnded || completingSetIds.includes(setId) || isFinishing) {
      return;
    }

    // Capture the previous set state for rollback on error.
    const prevSet = exercises
      .find((ex) => ex.id === exerciseId)
      ?.sets.find((s) => s.id === setId);

    if (!prevSet) return;

    // Optimistic update: flip to unlocked immediately for instant feedback.
    setExercises((current) =>
      updateExerciseState(current, exerciseId, (exerciseItem) => ({
        ...exerciseItem,
        sets: exerciseItem.sets.map((set) =>
          set.id === setId
            ? { ...set, isCompleted: false, isLocked: false, completedAt: null }
            : set
        )
      }))
    );
    updateIncompleteSetCount(1);
    setRevealedSetId((current) => (current === setId ? null : current));

    setCompletingSetIds((current) => [...current, setId]);
    clearTransientError();

    try {
      await postSetAction(setId, "unlock");
    } catch (error) {
      console.error("Failed to unlock workout set.", error);
      setExercises((current) =>
        updateExerciseState(current, exerciseId, (exerciseItem) => ({
          ...exerciseItem,
          sets: exerciseItem.sets.map((set) =>
            set.id === setId
              ? {
                  ...set,
                  isCompleted: prevSet.isCompleted,
                  isLocked: prevSet.isLocked,
                  completedAt: prevSet.completedAt
                }
              : set
          )
        }))
      );
      updateIncompleteSetCount(-1);
      setErrorMessage(error instanceof Error ? error.message : "ロック解除に失敗しました。");
    } finally {
      setCompletingSetIds((current) => current.filter((id) => id !== setId));
    }
  };

  const handleFinish = async (forceFinish = false) => {
    if (
      isSessionEnded ||
      isFinishing ||
      pendingMutation !== null ||
      completingSetIds.length > 0 ||
      pendingAddExerciseId !== null ||
      savingSetIds.length > 0
    ) {
      return;
    }

    setIsFinishing(true);
    clearTransientError();

    try {
      const payload = await postFinishSession(sessionMeta.id, forceFinish);
      if (payload.requiresConfirmation) {
        const confirmed = window.confirm(
          `${payload.incompleteSetCount}セットが未完了です。このままセッションを終了しますか。`
        );
        if (confirmed) {
          setIsFinishing(false);
          await handleFinish(true);
          return;
        }
        return;
      }

      applyFinishedState(payload);
      setRevealedSetId(null);
      // Flush the client-side router cache so Train/Programs/History see the
      // updated enrollment state (W1D2, new session in history) on next navigation.
      // router.refresh() is fire-and-forget; router.push navigates immediately.
      router.refresh();
      router.push(payload.summaryPath);
    } catch (error) {
      console.error("Failed to finish workout session.", error);
      setErrorMessage(error instanceof Error ? error.message : "セッション終了に失敗しました。");
    } finally {
      setIsFinishing(false);
    }
  };

  const handleCancel = async () => {
    if (
      isSessionEnded ||
      isCancelling ||
      isFinishing ||
      pendingMutation !== null ||
      completingSetIds.length > 0 ||
      savingSetIds.length > 0
    ) {
      return;
    }

    // Count completed sets to decide dialog wording
    const completedSetCount = exercises.reduce(
      (acc, block) =>
        acc +
        block.sets.filter((s) => s.isCompleted && s.deletedAt === null).length,
      0
    );

    const message =
      completedSetCount > 0
        ? `このワークアウトを中断しますか？完了済み${completedSetCount}セットは履歴に残りますが、セッションはキャンセルされます。`
        : "このワークアウトを中断しますか？完了済みセットはありません。";

    const confirmed = window.confirm(message);
    if (!confirmed) return;

    setIsCancelling(true);
    clearTransientError();

    try {
      await postCancelSession(sessionMeta.id);
      setRevealedSetId(null);
      restEndTimeRef.current = null;
      clearRestDoneTimeout();
      setRestSecondsLeft(null);
      // Hard navigation clears the Next.js client-side Router Cache.
      // router.replace("/") leaves a stale /train RSC payload in the cache, causing
      // the "トレーニング" tab to re-show the cancelled session without a reload.
      // window.location.href bypasses the cache; "/" then server-redirects to /programs.
      window.location.href = "/";
    } catch (error) {
      console.error("Failed to cancel workout session.", error);
      setRevealedSetId(null);
      setFailedAction("cancel");
      setErrorMessage(
        error instanceof Error ? error.message : "セッションのキャンセルに失敗しました。"
      );
    } finally {
      setIsCancelling(false);
    }
  };

  const loadExercises = async (groupSlug?: string | null) => {
    setIsLoadingExercises(true);
    setAddExerciseError(null);
    setFailedAction(null);
    try {
      let url: string;
      if (groupSlug) {
        url = `/api/exercises?swap_group=${encodeURIComponent(groupSlug)}`;
      } else if (isCustomSession) {
        url = "/api/exercises?include_history=true";
      } else {
        url = "/api/exercises";
      }
      const response = await fetch(url);
      const payload = (await response.json().catch(() => null)) as
        | { exercises: ExerciseListItem[] }
        | { error?: { message?: string } }
        | null;
      if (!response.ok) {
        throw new Error(
          payload && "error" in payload && payload.error?.message
            ? payload.error.message
            : "種目一覧の取得に失敗しました。"
        );
      }
      setExerciseList(
        (payload as { exercises: ExerciseListItem[] }).exercises ?? []
      );
    } catch (error) {
      setAddExerciseError(
        error instanceof Error ? error.message : "種目一覧の取得に失敗しました。"
      );
    } finally {
      setIsLoadingExercises(false);
    }
  };

  const openAddExerciseModal = async () => {
    if (isSessionEnded) return;
    setExerciseModalMode("add");
    setSwapTargetBlockId(null);
    setSwapGroupSlug(null);
    setIsAddExerciseModalOpen(true);
    setExerciseSearchQuery("");
    setSelectedMuscle(null);
    await loadExercises(null);
  };

  const openSwapModal = async (blockId: string, groupSlug?: string | null) => {
    if (isSessionEnded) return;
    setExerciseModalMode("swap");
    setSwapTargetBlockId(blockId);
    setSwapGroupSlug(groupSlug ?? null);
    setIsAddExerciseModalOpen(true);
    setExerciseSearchQuery("");
    setSelectedMuscle(null);
    await loadExercises(groupSlug);
  };

  const closeAddExerciseModal = () => {
    setIsAddExerciseModalOpen(false);
    setExerciseSearchQuery("");
    setSelectedMuscle(null);
    setAddExerciseError(null);
    setSwapTargetBlockId(null);
    setSwapGroupSlug(null);
    setIsCreateExerciseMode(false);
    setNewExerciseName("");
    setNewExerciseCategory("");
  };

  const isCustomSession = session.programDayId === null;

  const handleAddExercise = async (exerciseId: string, source: "library" | "user" = "library") => {
    if (isAddingExerciseId) return;
    setIsAddingExerciseId(exerciseId);
    setAddExerciseError(null);

    try {
      const result = await postAddExercise(sessionMeta.id, exerciseId, source);
      const { sessionExercise, sets, previousSets } = result;

      const newBlock: WorkoutExerciseBlock = {
        id: sessionExercise.id,
        exerciseId: sessionExercise.userExerciseId ?? sessionExercise.exerciseId ?? "",
        exerciseSlug: sessionExercise.exerciseSlug,
        exerciseNameJa: sessionExercise.exerciseNameJa,
        exerciseNameEn: sessionExercise.exerciseNameEn,
        exerciseType: sessionExercise.exerciseType,
        exerciseRoleLabel: isCustomSession ? "" : sessionExercise.exerciseType,
        orderIndex: sessionExercise.orderIndex,
        previousSets: previousSets ?? [],
        wasAdded: sessionExercise.wasAdded,
        wasSwapped: false,
        sets: sets.map((s, idx) => ({
          id: s.id,
          setNumber: s.setNumber,
          displaySetNumber: idx + 1,
          targetRepsText: s.targetRepsText,
          weightKg: s.weightKg,
          repsDone: s.repsDone,
          isCompleted: s.isCompleted,
          isLocked: s.isLocked,
          completedAt: s.completedAt,
          isAutoFilled: s.isAutoFilled,
          note: "",
          previousDisplay: s.previousDisplay,
          deletedAt: s.deletedAt
        }))
      };

      setExercises((current) =>
        withDisplaySetNumbers([...current, newBlock])
      );
      const newDrafts = Object.fromEntries(
        sets.map((s) => [s.id, { weightKg: "", repsDone: "" }])
      );
      setDraftInputs((current) => ({ ...current, ...newDrafts }));
      updateIncompleteSetCount(sets.length);
      setScrollToExerciseId(sessionExercise.id);
      closeAddExerciseModal();
    } catch (error) {
      console.error("Failed to add exercise.", error);
      setAddExerciseError(
        error instanceof Error ? error.message : "Add Exercise に失敗しました。"
      );
    } finally {
      setIsAddingExerciseId(null);
    }
  };

  const handleCreateAndAddExercise = async () => {
    const name = newExerciseName.trim();
    if (!name) {
      setAddExerciseError("種目名を入力してください。");
      return;
    }
    if (isCreatingExercise) return;
    setIsCreatingExercise(true);
    setAddExerciseError(null);

    try {
      const createRes = await fetch("/api/user-exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category: newExerciseCategory.trim() || undefined })
      });
      const createPayload = (await createRes.json().catch(() => null)) as
        | { exercise: { id: string; name: string; category: string | null } }
        | { error?: { message?: string } }
        | null;

      if (!createRes.ok || !createPayload || "error" in createPayload) {
        throw new Error(
          (createPayload && "error" in createPayload && createPayload.error?.message)
            ? createPayload.error.message
            : "種目の作成に失敗しました。"
        );
      }

      const newExercise = (createPayload as { exercise: { id: string; name: string; category: string | null } }).exercise;

      // Add newly created exercise to session.
      await handleAddExercise(newExercise.id, "user");

      // Also append to local exercise list so re-opening modal shows it.
      setExerciseList((prev) => [
        { id: newExercise.id, nameJa: newExercise.name, nameEn: newExercise.name, category: newExercise.category, source: "user" },
        ...prev
      ]);
      setIsCreateExerciseMode(false);
      setNewExerciseName("");
      setNewExerciseCategory("");
    } catch (err) {
      setAddExerciseError(err instanceof Error ? err.message : "種目の作成に失敗しました。");
    } finally {
      setIsCreatingExercise(false);
    }
  };

  const handleSwapExercise = async (
    newExerciseId: string,
    source: "library" | "user" = "library"
  ) => {
    if (!swapTargetBlockId || isAddingExerciseId) return;
    setIsAddingExerciseId(newExerciseId);
    setAddExerciseError(null);

    try {
      const result = await postSwapExercise(
        sessionMeta.id,
        swapTargetBlockId,
        newExerciseId,
        source
      );

      if (!result.noOp) {
        const { sessionExercise, previousSets } = result;
        setExercises((current) =>
          withDisplaySetNumbers(
            current.map((block) =>
              block.id === swapTargetBlockId
                ? {
                    ...block,
                    exerciseId:
                      sessionExercise.userExerciseId ??
                      sessionExercise.exerciseId ??
                      "",
                    exerciseSlug: sessionExercise.exerciseSlug,
                    exerciseNameJa: sessionExercise.exerciseNameJa,
                    exerciseNameEn: sessionExercise.exerciseNameEn,
                    exerciseType: sessionExercise.exerciseType,
                    wasSwapped: sessionExercise.wasSwapped,
                    previousSets: previousSets ?? []
                  }
                : block
            )
          )
        );
      }

      closeAddExerciseModal();
    } catch (error) {
      console.error("Failed to swap exercise.", error);
      setAddExerciseError(
        error instanceof Error ? error.message : "Swap に失敗しました。"
      );
    } finally {
      setIsAddingExerciseId(null);
    }
  };

  const MUSCLE_CHIPS: { label: string; value: string }[] = [
    { label: "胸", value: "chest" },
    { label: "背中", value: "back" },
    { label: "肩", value: "shoulders" },
    { label: "腕", value: "arms" },
    { label: "脚", value: "legs" },
    { label: "お尻", value: "glutes" },
    { label: "体幹", value: "core" },
  ];

  const CATEGORY_JA: Record<string, string> = {
    chest: "胸", back: "背中", shoulders: "肩", arms: "腕",
    legs: "脚", glutes: "お尻", core: "体幹"
  };
  const translateCategory = (cat: string | null | undefined) =>
    cat ? (CATEGORY_JA[cat] ?? cat) : "";

  const filteredExercises = exerciseList.filter((item) => {
    const q = exerciseSearchQuery.trim().toLowerCase();
    const matchesSearch = !q || item.nameJa.toLowerCase().includes(q) || item.nameEn.toLowerCase().includes(q);
    const matchesMuscle = !selectedMuscle || item.category === selectedMuscle; // selectedMuscle stores the English DB value
    return matchesSearch && matchesMuscle;
  });

  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <button
          className={`${styles.iconButton} ${styles.toolButton}${restSecondsLeft !== null ? ` ${restSecondsLeft === 0 ? styles.restDone : styles.restActive}` : ""}`}
          onClick={handleRestTimer}
          title={restSecondsLeft !== null ? "タップでキャンセル" : `レスト開始 (${formatRestTime(restDurationSec)})`}
          type="button"
        >
          <span className={styles.toolButtonLabel}>休憩</span>
          <span className={styles.toolButtonValue}>
            {restSecondsLeft !== null ? formatRestTime(restSecondsLeft) : formatRestTime(restDurationSec)}
          </span>
        </button>
        <button
          aria-label={timerSoundEnabled ? "タイマー音をオフにする" : "タイマー音をオンにする"}
          className={`${styles.iconButton} ${styles.soundToggleButton}${timerSoundEnabled ? "" : ` ${styles.soundMuted}`}`}
          title={timerSoundEnabled ? "タイマー音 ON" : "タイマー音 OFF"}
          type="button"
          onClick={() => {
            const next = !timerSoundEnabled;
            setTimerSoundEnabled(next);
            if (typeof window !== "undefined") {
              localStorage.setItem("restTimerSound", next ? "on" : "off");
            }
          }}
        >
          {timerSoundEnabled ? "🔔" : "🔕"}
        </button>
        <button
          className={`${styles.iconButton} ${styles.toolButton}`}
          type="button"
          onClick={() => setIs1RMModalOpen(true)}
        >
          <span className={styles.toolButtonLabel}>計算</span>
          <span className={styles.toolButtonHint}>1RM</span>
        </button>
        <div className={styles.timerPanel}>
          <span className={styles.timerLabel}>経過</span>
          <div className={styles.timer}>{formatElapsed(elapsedSeconds)}</div>
        </div>
        <div className={styles.topBarActions}>
          {!isSessionEnded && (
            <button
              className={styles.cancelButton}
              disabled={
                isCancelling ||
                isFinishing ||
                pendingMutation !== null ||
                completingSetIds.length > 0 ||
                savingSetIds.length > 0
              }
              onClick={handleCancel}
              type="button"
            >
              {isCancelling ? "..." : "キャンセル"}
            </button>
          )}
          <button
            className={`${styles.finishButton} ${
              isSessionCompleted
                ? styles.finishButtonCompleted
                : isSessionCancelled
                ? styles.finishButtonCancelled
                : ""
            }`}
            disabled={
              isSessionEnded ||
              isFinishing ||
              isCancelling ||
              pendingMutation !== null ||
              completingSetIds.length > 0 ||
              pendingAddExerciseId !== null ||
              savingSetIds.length > 0
            }
            onClick={() => handleFinish()}
            type="button"
          >
            {isSessionCompleted
              ? "完了済"
              : isSessionCancelled
              ? "キャンセル済"
              : isFinishing
              ? "完了処理中..."
              : "完了"}
          </button>
        </div>
      </div>

      {/* Rest duration settings — hidden while timer is running */}
      {restSecondsLeft === null && (
        <div className={styles.restDurationBar}>
          <div className={styles.restPresets}>
            {REST_DURATION_PRESETS.map((sec) => (
              <button
                key={sec}
                type="button"
                className={`${styles.restPresetBtn}${restDurationSec === sec ? ` ${styles.restPresetBtnActive}` : ""}`}
                onClick={() => applyRestDuration(sec)}
              >
                {formatRestTime(sec)}
              </button>
            ))}
          </div>
          <div className={styles.restAdjuster}>
            <button
              type="button"
              className={styles.restAdjBtn}
              disabled={restDurationSec <= REST_MIN_SEC}
              onClick={() => applyRestDuration(restDurationSec - 15)}
            >
              −15秒
            </button>
            <span className={styles.restDurCurrent}>{formatRestTime(restDurationSec)}</span>
            <button
              type="button"
              className={styles.restAdjBtn}
              disabled={restDurationSec >= REST_MAX_SEC}
              onClick={() => applyRestDuration(restDurationSec + 15)}
            >
              +15秒
            </button>
          </div>
        </div>
      )}

      <section className={styles.programCard}>
        {session.programWeekLabel ? (
          <span className={styles.weekDayBadge}>{formatWeekDay(session.programWeekLabel)}</span>
        ) : null}
        <h1 className={styles.programTitle}>今日のワークアウト</h1>
        <p className={styles.programMeta}>{session.programTitle}</p>
        <p className={styles.programNote}>{session.progressionGuide}</p>
        <p className={styles.programNote}>{session.notes}</p>
        {selectedProgram.state === "selected" ? (
          <div className={styles.selectionBanner}>
            <span className={styles.selectionLabel}>選択中プログラム</span>
            <strong className={styles.selectionValue}>
              {selectedProgram.programTitle}
            </strong>
            <span className={styles.selectionMeta}>
              slug: {selectedProgram.programSlug} / source: {formatProgramSourceLabel(selectedProgram.source)}
            </span>
          </div>
        ) : null}
        {selectedProgram.state === "invalid" ? (
          <div className={styles.selectionWarning} role="status">
            <strong>無効な選択</strong>
            <span>{selectedProgram.message}</span>
            <span>
              requested: {selectedProgram.requestedSlug} / fallback: current session
            </span>
          </div>
        ) : null}
        <div className={styles.hint}>
          <span>回数はターゲット値を初期表示。重量/回数はフォーカスを外すと保存されます</span>
        </div>
      </section>

      {isSessionCompleted ? (
        <section className={styles.completedBanner}>
          <strong>このワークアウトは完了済みです。</strong>
          <span>{formatFinishedAt(sessionMeta.finishedAt)}</span>
          <span>未完了セット残数: {sessionMeta.incompleteSetCount}</span>
        </section>
      ) : null}

      {isSessionCancelled ? (
        <section className={styles.cancelledBanner}>
          <strong>このワークアウトはキャンセルされました。</strong>
          <span>セットデータは履歴に残っています。</span>
        </section>
      ) : null}

      {errorMessage ? (
        <section className={styles.statusMessage} role="alert">
          <span>{errorMessage}</span>
          {showCancelRecoveryActions ? (
            <div className={styles.statusActions}>
              <a className={styles.statusActionPrimary} href="/">
                ホームへ戻る
              </a>
              <a className={styles.statusActionSecondary} href="/session-history">
                セッション履歴
              </a>
              <button
                className={styles.statusActionRetry}
                disabled={isCancelling || isFinishing}
                onClick={handleCancel}
                type="button"
              >
                キャンセル再試行
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className={styles.exerciseList}>
        {exercises.map((exercise) => {
          const exerciseSuggestion = getExerciseSuggestion(exercise, draftInputs);
          return (
          <article
            className={styles.exerciseCard}
            key={exercise.id}
            ref={(el) => { exerciseBlockRefs.current[exercise.id] = el; }}
          >
            <div className={styles.exerciseHeader}>
              {exercise.exerciseRoleLabel ? (
                <span className={typeClassName(exercise.exerciseType)}>{exercise.exerciseRoleLabel}</span>
              ) : null}
              <Link className={styles.exerciseLink} href={`/exercise-history/${exercise.exerciseSlug}`}>
                <span>{exercise.exerciseNameJa || exercise.exerciseNameEn}</span>
                <span aria-hidden="true">→</span>
              </Link>
              {exercise.wasSwapped ? (
                <span className={styles.swappedBadge}>置換済</span>
              ) : (
                <span className={styles.headerHint}>履歴へ</span>
              )}
            </div>

            {exercise.exerciseType === "T1" && exercise.t1ProgressionHint && (
              <div className={styles.t1ProgressionHintBar}>
                <span className={styles.t1ProgressionLabel}>次:</span>
                <span className={styles.t1ProgressionValue}>
                  {exercise.t1ProgressionHint.nextWeightKg}kg
                  {" · "}
                  {exercise.t1ProgressionHint.phaseBadge}
                </span>
              </div>
            )}

            {exercise.previousSets.length > 0 && (
              <div className={styles.previousSummary}>
                <span className={styles.previousSummaryLabel}>前回</span>
                <span className={styles.previousSummaryValues}>
                  {exercise.previousSets.map((s, i) => {
                    const label =
                      s.weightKg !== null && s.repsDone !== null ? `${s.weightKg}kg × ${s.repsDone}` :
                      s.weightKg !== null ? `${s.weightKg}kg` :
                      s.repsDone !== null ? `× ${s.repsDone}` : "-";
                    return (
                      <span key={s.setNumber}>
                        {i > 0 && <span className={styles.previousSummarySep}> · </span>}
                        {label}
                      </span>
                    );
                  })}
                </span>
              </div>
            )}

            <div className={styles.swipeHint}>
              左スワイプで削除・完了後も重量/回数は編集できます
            </div>

            <div className={styles.setTable}>
              <div className={styles.setHeader}>
                <span>#</span>
                <span>前回</span>
                <span>目標</span>
                <span>kg</span>
                <span>回数</span>
                <span>完</span>
              </div>

              {exercise.sets.map((set, setIndex) => {
                // previousSets はサーバー側で exerciseId-only キー + 最新セッション基準で構築済み。
                // set.previousDisplay はサーバー側 displayMap に依存するため、
                // index ズレが起きやすい。ここでは exercise.previousSets[setIndex] を直接参照する。
                const prevSet = exercise.previousSets[setIndex] ?? null;
                const prevDisplay = formatPrevDisplay(prevSet);

                const draft = getSetDraft(draftInputs, set);
                const { weightDiff, repsDiff } = calcSetDiff(draft, prevSet);
                const setEvalLabel = getSetEvalLabel(weightDiff, repsDiff, prevSet !== null);
                const isSaving = savingSetIds.includes(set.id);
                const isMutating = pendingMutation?.setId === set.id; // delete in progress
                const isCompleting = completingSetIds.includes(set.id); // complete/uncomplete in progress
                const isBusy = isSaving || isMutating; // for delete button only
                const isDeleteDisabled = isBusy || isSessionEnded;

                return (
                  <div className={styles.swipeRow} key={set.id}>
                    <div
                      className={`${styles.deleteLane} ${
                        revealedSetId === set.id ? styles.deleteLaneVisible : ""
                      }`}
                    >
                      <button
                        className={`${styles.deleteButton} ${isDeleteDisabled ? styles.deleteDisabled : ""}`}
                        disabled={isDeleteDisabled}
                        onClick={() => handleDelete(exercise.id, set.id)}
                        type="button"
                      >
                        {isMutating && pendingMutation?.kind === "delete"
                          ? "削除中..."
                          : "削除"}
                      </button>
                    </div>

                    <div
                      className={`${styles.swipeTrack} ${revealedSetId === set.id ? styles.swipeTrackRevealed : ""}`}
                      onMouseDown={(event) => handleSwipeStart(set.id, event.clientX)}
                      onMouseUp={(event) => handleSwipeEnd(set.id, event.clientX)}
                      onTouchStart={(event) => handleSwipeStart(set.id, event.changedTouches[0].clientX)}
                      onTouchEnd={(event) => handleSwipeEnd(set.id, event.changedTouches[0].clientX)}
                    >
                      <div className={`${styles.setRow} ${set.isCompleted ? styles.completedRow : ""}`}>
                        <span className={styles.mono}>{set.displaySetNumber}</span>
                        <span className={`${styles.previous} ${prevDisplay === "-" ? styles.previousEmpty : ""}`}>
                          <span className={styles.previousText}>{prevDisplay}</span>
                          {((weightDiff !== null && weightDiff !== 0) || (repsDiff !== null && repsDiff !== 0)) && (
                            <span className={styles.diffLine}>
                              {weightDiff !== null && weightDiff !== 0 && (
                                <span className={weightDiff > 0 ? styles.diffPositive : styles.diffNegative}>
                                  {weightDiff > 0 ? "+" : ""}{weightDiff}kg
                                </span>
                              )}
                              {repsDiff !== null && repsDiff !== 0 && (
                                <span className={repsDiff > 0 ? styles.diffPositive : styles.diffNegative}>
                                  {repsDiff > 0 ? "+" : ""}{repsDiff}
                                </span>
                              )}
                            </span>
                          )}
                        </span>
                        <button
                          className={`${styles.target}${!isSessionEnded ? ` ${styles.targetClickable}` : ""}`}
                          disabled={isSessionEnded}
                          onClick={() => handleFillFromTarget(exercise.id, set.id, set.targetRepsText)}
                          title="タップで回数に反映"
                          type="button"
                        >
                          {set.targetRepsText ?? "-"}
                        </button>
                        <input
                          aria-label={`${exercise.exerciseNameEn} セット${set.displaySetNumber} 重量`}
                          className={`${styles.input} ${isSaving ? styles.inputSaving : ""} ${set.isAutoFilled ? styles.inputAutoFilled : ""}`}
                          disabled={isSaving || isSessionEnded}
                          inputMode="decimal"
                          onBlur={() => handleInputSave(exercise.id, set.id)}
                          onChange={(event) => handleInputChange(exercise.id, set.id, "weightKg", event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              event.currentTarget.blur();
                            }
                          }}
                          ref={(element) => {
                            kgInputRefs.current[set.id] = element;
                          }}
                          type="number"
                          value={draft.weightKg}
                        />
                        <input
                          aria-label={`${exercise.exerciseNameEn} セット${set.displaySetNumber} 回数`}
                          className={`${styles.input} ${isSaving ? styles.inputSaving : ""}`}
                          disabled={isSaving || isSessionEnded}
                          inputMode="numeric"
                          onBlur={() => handleInputSave(exercise.id, set.id)}
                          onChange={(event) => handleInputChange(exercise.id, set.id, "repsDone", event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              event.currentTarget.blur();
                            }
                          }}
                          type="number"
                          value={draft.repsDone}
                        />
                        <button
                          aria-label={set.isCompleted ? "完了を取り消す" : "完了にする"}
                          aria-pressed={set.isCompleted}
                          className={`${styles.actionButton} ${styles.check} ${set.isCompleted ? styles.checkDone : ""}`}
                          data-completed={set.isCompleted ? "true" : "false"}
                          disabled={isCompleting || isSessionEnded}
                          onClick={() =>
                            set.isCompleted
                              ? handleUncomplete(exercise.id, set.id)
                              : handleComplete(exercise.id, set.id)
                          }
                          type="button"
                        >
                          <span aria-hidden="true" className={styles.checkIcon}>
                            {isCompleting ? "..." : "\u2713"}
                          </span>
                        </button>
                      </div>
                      {setEvalLabel && (
                        <div className={
                          setEvalLabel.variant === "positive"
                            ? styles.setEvalPositive
                            : setEvalLabel.variant === "negative"
                              ? styles.setEvalNegative
                              : styles.setEvalNeutral
                        }>
                          {setEvalLabel.text}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {exerciseSuggestion && (
              <p className={exerciseSuggestion.positive ? styles.suggestionPositive : styles.suggestionNegative}>
                {exerciseSuggestion.positive ? "↑ " : "→ "}{exerciseSuggestion.text}
              </p>
            )}

            <div className={styles.exerciseActions}>
              <button
                className={styles.primaryGhostButton}
                disabled={pendingAddExerciseId === exercise.id || isSessionEnded}
                onClick={() => handleAddSet(exercise.id)}
                type="button"
              >
                {pendingAddExerciseId === exercise.id ? "追加中..." : "＋ セット追加"}
              </button>
              <button
                className={styles.subtleButton}
                disabled={isSessionEnded}
                onClick={() => openSwapModal(exercise.id, exercise.swapGroupSlug)}
                type="button"
              >
                種目変更
              </button>
              <button className={styles.subtleButton} disabled={isSessionEnded} type="button">
                ...
              </button>
            </div>
          </article>
          );
        })}
      </section>

      <div className={styles.footerAction}>
        <button
          className={styles.primaryGhostButton}
          disabled={isSessionEnded}
          onClick={openAddExerciseModal}
          type="button"
        >
          ＋ 種目追加
        </button>
      </div>

      {isRefreshing ? (
        <div className={styles.refreshState}>トレーニングデータを更新中...</div>
      ) : null}

      {isAddExerciseModalOpen ? (
        <div
          className={styles.modalBackdrop}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeAddExerciseModal();
          }}
        >
          <div className={styles.modal} role="dialog" aria-modal="true" aria-label="種目追加">
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {exerciseModalMode === "add" ? "種目追加" : "種目変更"}
              </h2>
              <button
                className={styles.modalCloseButton}
                onClick={closeAddExerciseModal}
                type="button"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>
            {exerciseModalMode === "swap" && swapTargetBlockId ? (
              <div className={styles.modalSubtitle}>
                置換対象:{" "}
                <strong>
                  {(() => {
                    const b = exercises.find((x) => x.id === swapTargetBlockId);
                    return b ? (b.exerciseNameJa || b.exerciseNameEn) : "";
                  })()}
                </strong>
                {swapGroupSlug ? (
                  <span className={styles.swapGroupHint}> — 推奨代替種目</span>
                ) : null}
              </div>
            ) : null}

            <div className={styles.modalSearchWrapper}>
              <input
                autoFocus
                className={styles.modalSearch}
                onChange={(e) => setExerciseSearchQuery(e.target.value)}
                placeholder="種目名で絞り込む..."
                type="search"
                value={exerciseSearchQuery}
              />
            </div>

            <div className={styles.muscleFilter}>
              <span className={styles.muscleFilterLabel}>どこを鍛えますか？</span>
              <div className={styles.muscleChipRow}>
                {MUSCLE_CHIPS.map((muscle) => (
                  <button
                    className={`${styles.muscleChip} ${selectedMuscle === muscle.value ? styles.muscleChipActive : ""}`}
                    key={muscle.value}
                    onClick={() => setSelectedMuscle(selectedMuscle === muscle.value ? null : muscle.value)}
                    type="button"
                  >
                    {muscle.label}
                  </button>
                ))}
              </div>
            </div>

            {addExerciseError ? (
              <div className={styles.modalErrorMessage} role="alert">
                {addExerciseError}
              </div>
            ) : null}

            <ul className={styles.modalList} role="list">
              {isLoadingExercises ? (
                <li className={styles.modalEmpty}>読み込み中...</li>
              ) : filteredExercises.length === 0 ? (
                <li className={styles.modalEmpty}>
                  {exerciseSearchQuery.trim()
                    ? "該当する種目が見つかりません。"
                    : "種目データがありません。"}
                </li>
              ) : (
                filteredExercises.map((item) => (
                  <li className={styles.modalListItem} key={item.id} role="listitem">
                    <button
                      className={styles.modalListItemButton}
                      disabled={isAddingExerciseId !== null}
                      onClick={() =>
                        exerciseModalMode === "add"
                          ? handleAddExercise(item.id, item.source === "user" ? "user" : "library")
                          : handleSwapExercise(item.id, item.source === "user" ? "user" : "library")
                      }
                      type="button"
                    >
                      <span className={styles.modalListItemName}>
                        {item.nameJa}
                        {item.source === "user" && (
                          <span className={styles.userExerciseTag}>自分</span>
                        )}
                      </span>
                      <span className={styles.modalListItemSub}>
                        {item.source !== "user" && item.nameEn}
                        {item.category ? ` · ${translateCategory(item.category)}` : ""}
                        {isCustomSession && exerciseModalMode === "add" && item.source !== "user" && item.lastWeightKg !== undefined
                          ? item.lastWeightKg !== null
                            ? ` · 前回: ${item.lastWeightKg}kg${item.lastRepsDone !== null ? ` × ${item.lastRepsDone}` : ""}${item.lastDate ? ` (${item.lastDate})` : ""}`
                            : " · 履歴なし"
                          : ""}
                        {isAddingExerciseId === item.id
                          ? exerciseModalMode === "add"
                            ? " — 追加中..."
                            : " — 置換中..."
                          : ""}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>

            {/* Create new personal exercise — only in add mode for custom sessions */}
            {exerciseModalMode === "add" && isCustomSession && (
              <div className={styles.createExerciseSection}>
                {isCreateExerciseMode ? (
                  <div className={styles.createExerciseForm}>
                    <p className={styles.createExerciseTitle}>新しい種目を作成</p>
                    <input
                      autoFocus
                      className={styles.createExerciseInput}
                      maxLength={100}
                      placeholder="種目名（必須）"
                      type="text"
                      value={newExerciseName}
                      onChange={(e) => setNewExerciseName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCreateAndAddExercise();
                        }
                      }}
                    />
                    <input
                      className={styles.createExerciseInput}
                      maxLength={50}
                      placeholder="カテゴリ（任意）"
                      type="text"
                      value={newExerciseCategory}
                      onChange={(e) => setNewExerciseCategory(e.target.value)}
                    />
                    <div className={styles.createExerciseActions}>
                      <button
                        className={styles.createExerciseSubmit}
                        disabled={isCreatingExercise || !newExerciseName.trim()}
                        type="button"
                        onClick={handleCreateAndAddExercise}
                      >
                        {isCreatingExercise ? "作成中…" : "作成して追加"}
                      </button>
                      <button
                        className={styles.createExerciseCancel}
                        type="button"
                        onClick={() => {
                          setIsCreateExerciseMode(false);
                          setNewExerciseName("");
                          setNewExerciseCategory("");
                        }}
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className={styles.createExerciseToggle}
                    type="button"
                    onClick={() => setIsCreateExerciseMode(true)}
                  >
                    ＋ 新しい種目を作成
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* 1RM calculator modal */}
      {is1RMModalOpen ? (
        <div
          className={styles.modalBackdrop}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIs1RMModalOpen(false);
          }}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label="推定1RM計算"
          >
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>推定1RM計算</h2>
              <button
                className={styles.modalCloseButton}
                type="button"
                aria-label="閉じる"
                onClick={() => setIs1RMModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className={styles.calc1RMBody}>
              <div className={styles.calc1RMInputRow}>
                <div className={styles.calc1RMField}>
                  <label className={styles.calc1RMLabel} htmlFor="calc-weight">
                    重量 (kg)
                  </label>
                  <input
                    autoFocus
                    id="calc-weight"
                    className={styles.calc1RMInput}
                    inputMode="decimal"
                    min="0"
                    placeholder="例: 100"
                    type="number"
                    value={calc1RMWeight}
                    onChange={(e) => setCalc1RMWeight(e.target.value)}
                  />
                </div>
                <div className={styles.calc1RMField}>
                  <label className={styles.calc1RMLabel} htmlFor="calc-reps">
                    回数
                  </label>
                  <input
                    id="calc-reps"
                    className={styles.calc1RMInput}
                    inputMode="numeric"
                    min="1"
                    placeholder="例: 5"
                    type="number"
                    value={calc1RMReps}
                    onChange={(e) => setCalc1RMReps(e.target.value)}
                  />
                </div>
              </div>

              {(() => {
                const rmResult = compute1RM(calc1RMWeight, calc1RMReps);
                if (!rmResult.ok) {
                  const bothTouched =
                    calc1RMWeight.trim() !== "" || calc1RMReps.trim() !== "";
                  return bothTouched ? (
                    <p className={styles.calc1RMError} role="alert">
                      {rmResult.error}
                    </p>
                  ) : (
                    <div className={styles.calc1RMPlaceholder}>
                      重量と回数を入力すると推定1RMが表示されます。
                    </div>
                  );
                }
                return (
                  <div className={styles.calc1RMResult}>
                    <span className={styles.calc1RMResultLabel}>推定1RM</span>
                    <span className={styles.calc1RMResultValue}>
                      {rmResult.value} kg
                    </span>
                    <span className={styles.calc1RMResultSub}>
                      {calc1RMWeight}kg × {calc1RMReps}回 (Epley式)
                    </span>
                  </div>
                );
              })()}

              <p className={styles.calc1RMNote}>
                ※ Epley式による目安値です。実際の1RMは体調・フォームにより異なります。
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

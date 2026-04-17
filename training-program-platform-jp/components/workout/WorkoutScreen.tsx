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
    exercise.sets.forEach((set) => {
      accumulator[set.id] = {
        weightKg: stringifyNumber(set.weightKg),
        repsDone: defaultRepsDraft(set.repsDone, set.targetRepsText)
      };
    });
    return accumulator;
  }, {});
}

/** Formats rest-timer seconds as M:SS. 0 returns "Done!". */
function formatRestTime(seconds: number): string {
  if (seconds === 0) return "Done!";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
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

async function postAddExercise(sessionId: string, exerciseId: string) {
  const response = await fetch(`/api/workout-sessions/${sessionId}/exercises`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exercise_id: exerciseId })
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
  newExerciseId: string
) {
  const response = await fetch(
    `/api/workout-sessions/${sessionId}/exercises/${sessionExerciseId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exercise_id: newExerciseId })
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
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "完了日時は未記録";
  return `完了日時: ${parsed.toLocaleString("ja-JP")}`;
}

function formatProgramSourceLabel(source: TrainProgramSelection["source"]) {
  if (source === "supabase") return "Supabase";
  if (source === "mock_catalog") return "mock catalog";
  return "unknown";
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
  const [focusSetId, setFocusSetId] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const REST_DEFAULT_SEC = 90;
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const restEndTimeRef = useRef<number | null>(null);
  const restDoneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add Exercise / Swap modal
  const [isAddExerciseModalOpen, setIsAddExerciseModalOpen] = useState(false);
  const [exerciseModalMode, setExerciseModalMode] = useState<"add" | "swap">("add");
  const [swapTargetBlockId, setSwapTargetBlockId] = useState<string | null>(null);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState("");
  const [exerciseList, setExerciseList] = useState<ExerciseListItem[]>([]);
  const [isLoadingExercises, setIsLoadingExercises] = useState(false);
  const [isAddingExerciseId, setIsAddingExerciseId] = useState<string | null>(null);
  const [addExerciseError, setAddExerciseError] = useState<string | null>(null);
  const [scrollToExerciseId, setScrollToExerciseId] = useState<string | null>(null);
  const exerciseBlockRefs = useRef<Record<string, HTMLElement | null>>({});

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
    restEndTimeRef.current = null;
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

  const handleRestTimer = () => {
    clearRestDoneTimeout();
    if (restEndTimeRef.current !== null) {
      restEndTimeRef.current = null;
      setRestSecondsLeft(null);
      return;
    }

    restEndTimeRef.current = Date.now() + REST_DEFAULT_SEC * 1000;
    setRestSecondsLeft(REST_DEFAULT_SEC);
  };

  const isSessionCompleted = sessionMeta.status === "completed";
  const isSessionCancelled = sessionMeta.status === "cancelled";
  /** True when session is no longer editable (completed or cancelled). */
  const isSessionEnded = isSessionCompleted || isSessionCancelled;

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
    setErrorMessage(null);
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

    setErrorMessage(null);
    const shouldReflectWeight =
      field === "weightKg" && targetSet.displaySetNumber === 1 && nextValue.trim() !== "";

    const reflectedSetIds = shouldReflectWeight
      ? exercise.sets
          .filter((candidate) => candidate.id !== setId && !candidate.isCompleted)
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
                  isCompleted: payload.isCompleted ?? set.isCompleted,
                  isLocked: payload.isLocked ?? set.isLocked,
                  completedAt: payload.completedAt ?? set.completedAt,
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
    setErrorMessage(null);

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
    setErrorMessage(null);

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
      refreshTrainScreen();
    } catch (error) {
      console.error("Failed to delete workout set.", error);
      setErrorMessage(error instanceof Error ? error.message : "セット削除に失敗しました。");
    } finally {
      setPendingMutation(null);
    }
  };

  const handleComplete = async (exerciseId: string, setId: string) => {
    if (isSessionEnded || pendingMutation || savingSetIds.includes(setId) || isFinishing) {
      return;
    }

    setPendingMutation({ setId, kind: "complete" });
    setErrorMessage(null);

    try {
      const payload = await postSetAction(setId, "complete");
      setExercises((current) =>
        updateExerciseState(current, exerciseId, (exerciseItem) => ({
          ...exerciseItem,
          sets: exerciseItem.sets.map((set) =>
            set.id === setId
              ? {
                  ...set,
                  isCompleted: payload.isCompleted ?? true,
                  isLocked: payload.isLocked ?? false,
                  completedAt: payload.completedAt ?? new Date().toISOString()
                }
              : set
          )
        }))
      );
      updateIncompleteSetCount(-1);
      refreshTrainScreen();
    } catch (error) {
      console.error("Failed to complete workout set.", error);
      setErrorMessage(error instanceof Error ? error.message : "セット完了に失敗しました。");
    } finally {
      setPendingMutation(null);
    }
  };

  const handleUncomplete = async (exerciseId: string, setId: string) => {
    if (isSessionEnded || pendingMutation || savingSetIds.includes(setId) || isFinishing) {
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

    setPendingMutation({ setId, kind: "unlock" });
    setErrorMessage(null);

    try {
      await postSetAction(setId, "unlock");
      // Server confirmed — keep optimistic state. Soft refresh for consistency.
      refreshTrainScreen();
    } catch (error) {
      console.error("Failed to unlock workout set.", error);
      // Rollback to the previous locked state.
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
      setPendingMutation(null);
    }
  };

  const handleFinish = async (forceFinish = false) => {
    if (
      isSessionEnded ||
      isFinishing ||
      pendingMutation !== null ||
      pendingAddExerciseId !== null ||
      savingSetIds.length > 0
    ) {
      return;
    }

    setIsFinishing(true);
    setErrorMessage(null);

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
        ? `Discard this workout? ${completedSetCount} completed set${completedSetCount !== 1 ? "s" : ""} will be kept in history but this session will be marked as cancelled.`
        : "Discard this workout? No completed sets will be lost.";

    const confirmed = window.confirm(message);
    if (!confirmed) return;

    setIsCancelling(true);
    setErrorMessage(null);

    try {
      await postCancelSession(sessionMeta.id);
      setRevealedSetId(null);
      restEndTimeRef.current = null;
      clearRestDoneTimeout();
      setRestSecondsLeft(null);
      router.push("/");
    } catch (error) {
      console.error("Failed to cancel workout session.", error);
      setErrorMessage(
        error instanceof Error ? error.message : "セッションのキャンセルに失敗しました。"
      );
    } finally {
      setIsCancelling(false);
    }
  };

  const loadExercises = async () => {
    setIsLoadingExercises(true);
    setAddExerciseError(null);
    try {
      const response = await fetch("/api/exercises");
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
    setIsAddExerciseModalOpen(true);
    setExerciseSearchQuery("");
    await loadExercises();
  };

  const openSwapModal = async (blockId: string) => {
    if (isSessionEnded) return;
    setExerciseModalMode("swap");
    setSwapTargetBlockId(blockId);
    setIsAddExerciseModalOpen(true);
    setExerciseSearchQuery("");
    await loadExercises();
  };

  const closeAddExerciseModal = () => {
    setIsAddExerciseModalOpen(false);
    setExerciseSearchQuery("");
    setAddExerciseError(null);
    setSwapTargetBlockId(null);
  };

  const handleAddExercise = async (exerciseId: string) => {
    if (isAddingExerciseId) return;
    setIsAddingExerciseId(exerciseId);
    setAddExerciseError(null);

    try {
      const result = await postAddExercise(sessionMeta.id, exerciseId);
      const { sessionExercise, initialSet } = result;

      const newBlock: WorkoutExerciseBlock = {
        id: sessionExercise.id,
        exerciseId: sessionExercise.exerciseId,
        exerciseSlug: sessionExercise.exerciseSlug,
        exerciseNameJa: sessionExercise.exerciseNameJa,
        exerciseNameEn: sessionExercise.exerciseNameEn,
        exerciseType: sessionExercise.exerciseType,
        orderIndex: sessionExercise.orderIndex,
        previousSets: [],
        wasAdded: sessionExercise.wasAdded,
        wasSwapped: false,
        sets: [
          {
            id: initialSet.id,
            setNumber: initialSet.setNumber,
            displaySetNumber: 1,
            targetRepsText: initialSet.targetRepsText,
            weightKg: initialSet.weightKg,
            repsDone: initialSet.repsDone,
            isCompleted: initialSet.isCompleted,
            isLocked: initialSet.isLocked,
            completedAt: initialSet.completedAt,
            isAutoFilled: initialSet.isAutoFilled,
            note: "",
            previousDisplay: initialSet.previousDisplay,
            deletedAt: initialSet.deletedAt
          }
        ]
      };

      setExercises((current) =>
        withDisplaySetNumbers([...current, newBlock])
      );
      setDraftInputs((current) => ({
        ...current,
        [initialSet.id]: { weightKg: "", repsDone: "" }
      }));
      updateIncompleteSetCount(1);
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

  const handleSwapExercise = async (newExerciseId: string) => {
    if (!swapTargetBlockId || isAddingExerciseId) return;
    setIsAddingExerciseId(newExerciseId);
    setAddExerciseError(null);

    try {
      const result = await postSwapExercise(
        sessionMeta.id,
        swapTargetBlockId,
        newExerciseId
      );

      if (!result.noOp) {
        const { sessionExercise } = result;
        setExercises((current) =>
          withDisplaySetNumbers(
            current.map((block) =>
              block.id === swapTargetBlockId
                ? {
                    ...block,
                    exerciseId: sessionExercise.exerciseId,
                    exerciseSlug: sessionExercise.exerciseSlug,
                    exerciseNameJa: sessionExercise.exerciseNameJa,
                    exerciseNameEn: sessionExercise.exerciseNameEn,
                    exerciseType: sessionExercise.exerciseType,
                    wasSwapped: sessionExercise.wasSwapped
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

  const filteredExercises = exerciseList.filter((item) => {
    const q = exerciseSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.nameJa.toLowerCase().includes(q) ||
      item.nameEn.toLowerCase().includes(q)
    );
  });

  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <button
          className={`${styles.iconButton}${restSecondsLeft !== null ? ` ${restSecondsLeft === 0 ? styles.restDone : styles.restActive}` : ""}`}
          onClick={handleRestTimer}
          title={restSecondsLeft !== null ? "タップでキャンセル" : "レスト開始 (1:30)"}
          type="button"
        >
          {restSecondsLeft !== null ? formatRestTime(restSecondsLeft) : "Rest"}
        </button>
        <button className={styles.iconButton} type="button">Calc</button>
        <div className={styles.timer}>{formatElapsed(elapsedSeconds)}</div>
        <div className={styles.topBarActions}>
          {!isSessionEnded && (
            <button
              className={styles.cancelButton}
              disabled={
                isCancelling ||
                isFinishing ||
                pendingMutation !== null ||
                savingSetIds.length > 0
              }
              onClick={handleCancel}
              type="button"
            >
              {isCancelling ? "..." : "Cancel"}
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
              pendingAddExerciseId !== null ||
              savingSetIds.length > 0
            }
            onClick={() => handleFinish()}
            type="button"
          >
            {isSessionCompleted
              ? "Completed"
              : isSessionCancelled
              ? "Cancelled"
              : isFinishing
              ? "Finishing..."
              : "Finish"}
          </button>
        </div>
      </div>

      <section className={styles.programCard}>
        <h1 className={styles.programTitle}>今日のワークアウト</h1>
        <p className={styles.programMeta}>{session.programTitle} / {session.programWeekLabel}</p>
        <p className={styles.programNote}>{session.progressionGuide}</p>
        <p className={styles.programNote}>{session.notes}</p>
        {selectedProgram.state === "selected" ? (
          <div className={styles.selectionBanner}>
            <span className={styles.selectionLabel}>Selected Program</span>
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
            <strong>Invalid selection</strong>
            <span>{selectedProgram.message}</span>
            <span>
              requested: {selectedProgram.requestedSlug} / fallback: current session
            </span>
          </div>
        ) : null}
        <div className={styles.hint}>
          <span>Reps はターゲット値を初期入力。Kg / Reps は onBlur で保存</span>
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

      {errorMessage ? <div className={styles.statusMessage} role="alert">{errorMessage}</div> : null}

      <section className={styles.exerciseList}>
        {exercises.map((exercise) => (
          <article
            className={styles.exerciseCard}
            key={exercise.id}
            ref={(el) => { exerciseBlockRefs.current[exercise.id] = el; }}
          >
            <div className={styles.exerciseHeader}>
              <span className={typeClassName(exercise.exerciseType)}>{exercise.exerciseType}</span>
              <Link className={styles.exerciseLink} href={`/exercise-history/${exercise.exerciseSlug}`}>
                <span>{exercise.exerciseNameEn}</span>
                <span aria-hidden="true">→</span>
              </Link>
              {exercise.wasSwapped ? (
                <span className={styles.swappedBadge}>Swapped</span>
              ) : (
                <span className={styles.headerHint}>履歴へ</span>
              )}
            </div>

            <div className={styles.swipeHint}>
              左スワイプで Delete ・ 完了後も Kg / Reps はそのまま編集できます
            </div>

            <div className={styles.setTable}>
              <div className={styles.setHeader}>
                <span>#</span>
                <span>Previous</span>
                <span>Target</span>
                <span>Kg</span>
                <span>Reps</span>
                <span>Done</span>
              </div>

              {exercise.sets.map((set) => {
                const draft = getSetDraft(draftInputs, set);
                const isSaving = savingSetIds.includes(set.id);
                const isMutating = pendingMutation?.setId === set.id;
                const isBusy = isSaving || isMutating;
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
                          ? "Deleting..."
                          : "Delete"}
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
                        <span className={`${styles.previous} ${set.previousDisplay === "-" ? styles.previousEmpty : ""}`}>
                          {set.previousDisplay}
                        </span>
                        <button
                          className={`${styles.target}${!isSessionEnded ? ` ${styles.targetClickable}` : ""}`}
                          disabled={isSessionEnded}
                          onClick={() => handleFillFromTarget(exercise.id, set.id, set.targetRepsText)}
                          title="クリックでRepsに反映"
                          type="button"
                        >
                          {set.targetRepsText ?? "-"}
                        </button>
                        <input
                          aria-label={`${exercise.exerciseNameEn} set ${set.displaySetNumber} kg`}
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
                          aria-label={`${exercise.exerciseNameEn} set ${set.displaySetNumber} reps`}
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
                          aria-label={set.isCompleted ? "mark incomplete" : "mark complete"}
                          aria-pressed={set.isCompleted}
                          className={`${styles.actionButton} ${styles.check} ${set.isCompleted ? styles.checkDone : ""}`}
                          disabled={isBusy || isSessionEnded}
                          onClick={() =>
                            set.isCompleted
                              ? handleUncomplete(exercise.id, set.id)
                              : handleComplete(exercise.id, set.id)
                          }
                          type="button"
                        >
                          {isMutating &&
                          (pendingMutation?.kind === "complete" || pendingMutation?.kind === "unlock")
                            ? "..."
                            : set.isCompleted
                              ? "✓"
                              : ""}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={styles.exerciseActions}>
              <button
                className={styles.primaryGhostButton}
                disabled={pendingAddExerciseId === exercise.id || isSessionEnded}
                onClick={() => handleAddSet(exercise.id)}
                type="button"
              >
                {pendingAddExerciseId === exercise.id ? "Adding..." : "+ Add Set"}
              </button>
              <button
                className={styles.subtleButton}
                disabled={isSessionEnded}
                onClick={() => openSwapModal(exercise.id)}
                type="button"
              >
                Swap
              </button>
              <button className={styles.subtleButton} disabled={isSessionEnded} type="button">
                ...
              </button>
            </div>
          </article>
        ))}
      </section>

      <div className={styles.footerAction}>
        <button
          className={styles.primaryGhostButton}
          disabled={isSessionEnded}
          onClick={openAddExerciseModal}
          type="button"
        >
          + Add Exercise
        </button>
      </div>

      {isRefreshing ? (
        <div className={styles.refreshState}>Refreshing train data...</div>
      ) : null}

      {isAddExerciseModalOpen ? (
        <div
          className={styles.modalBackdrop}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeAddExerciseModal();
          }}
        >
          <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Add Exercise">
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {exerciseModalMode === "add" ? "Add Exercise" : "Swap Exercise"}
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
                  {exercises.find((b) => b.id === swapTargetBlockId)
                    ?.exerciseNameEn ?? ""}
                </strong>
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
                          ? handleAddExercise(item.id)
                          : handleSwapExercise(item.id)
                      }
                      type="button"
                    >
                      <span className={styles.modalListItemName}>{item.nameJa}</span>
                      <span className={styles.modalListItemSub}>
                        {item.nameEn}
                        {item.category ? ` · ${item.category}` : ""}
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
          </div>
        </div>
      ) : null}
    </main>
  );
}

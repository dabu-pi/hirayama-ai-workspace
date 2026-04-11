"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import type {
  AddExerciseResponse,
  ExerciseListItem,
  WorkoutExerciseBlock,
  WorkoutSet,
  WorkoutSessionStatus,
  WorkoutSessionView
} from "@/types/workout";

import styles from "./WorkoutScreen.module.css";

type WorkoutScreenProps = {
  session: WorkoutSessionView;
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

type FinishResponse = {
  id: string;
  status: WorkoutSessionStatus;
  finishedAt: string | null;
  incompleteSetCount: number;
  requiresConfirmation?: boolean;
  message?: string;
};

function typeClassName(exerciseType: "T1" | "T2" | "T3") {
  if (exerciseType === "T1") return `${styles.typeBadge} ${styles.typeT1}`;
  if (exerciseType === "T2") return `${styles.typeBadge} ${styles.typeT2}`;
  return `${styles.typeBadge} ${styles.typeT3}`;
}

function stringifyNumber(value: number | null) {
  return value === null ? "" : String(value);
}

function buildDraftInputs(exercises: WorkoutExerciseBlock[]) {
  return exercises.reduce<SetDraftMap>((accumulator, exercise) => {
    exercise.sets.forEach((set) => {
      accumulator[set.id] = {
        weightKg: stringifyNumber(set.weightKg),
        repsDone: stringifyNumber(set.repsDone)
      };
    });
    return accumulator;
  }, {});
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
    | FinishResponse
    | { error?: { message?: string } }
    | null;

  if (response.status === 409 && payload && "requiresConfirmation" in payload) {
    return payload as FinishResponse;
  }

  if (!response.ok) {
    throw new Error(
      payload && "error" in payload && payload.error?.message
        ? payload.error.message
        : "Finish に失敗しました。"
    );
  }

  return payload as FinishResponse;
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

export function WorkoutScreen({ session }: WorkoutScreenProps) {
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
  const [revealedSetId, setRevealedSetId] = useState<string | null>(null);
  const [pendingMutation, setPendingMutation] = useState<PendingMutation>(null);
  const [pendingAddExerciseId, setPendingAddExerciseId] = useState<string | null>(null);
  const [savingSetIds, setSavingSetIds] = useState<string[]>([]);
  const [focusSetId, setFocusSetId] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, startRefreshTransition] = useTransition();

  // Add Exercise modal
  const [isAddExerciseModalOpen, setIsAddExerciseModalOpen] = useState(false);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState("");
  const [exerciseList, setExerciseList] = useState<ExerciseListItem[]>([]);
  const [isLoadingExercises, setIsLoadingExercises] = useState(false);
  const [isAddingExerciseId, setIsAddingExerciseId] = useState<string | null>(null);
  const [addExerciseError, setAddExerciseError] = useState<string | null>(null);
  const [scrollToExerciseId, setScrollToExerciseId] = useState<string | null>(null);
  const exerciseBlockRefs = useRef<Record<string, HTMLElement | null>>({});

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

  const isSessionCompleted = sessionMeta.status === "completed";

  const refreshTrainScreen = () => {
    startRefreshTransition(() => router.refresh());
  };

  const updateIncompleteSetCount = (delta: number) => {
    setSessionMeta((current) => ({
      ...current,
      incompleteSetCount: Math.max(0, current.incompleteSetCount + delta)
    }));
  };

  const applyFinishedState = (payload: FinishResponse) => {
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

  const handleSwipeStart = (setId: string, clientX: number) => {
    if (isSessionCompleted) return;
    swipeRef.current = { setId, startX: clientX };
  };

  const handleSwipeEnd = (setId: string, clientX: number) => {
    if (isSessionCompleted || !swipeRef.current) return;
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
    if (isSessionCompleted) return;
    const exercise = exercises.find((item) => item.id === exerciseId);
    const targetSet = exercise?.sets.find((item) => item.id === setId);
    if (!exercise || !targetSet || targetSet.isLocked) return;

    setErrorMessage(null);
    const shouldReflectWeight =
      field === "weightKg" && targetSet.displaySetNumber === 1 && nextValue.trim() !== "";

    const reflectedSetIds = shouldReflectWeight
      ? exercise.sets
          .filter((candidate) => candidate.id !== setId && !candidate.isLocked)
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
      isSessionCompleted ||
      !exercise ||
      !targetSet ||
      targetSet.isLocked ||
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
    if (isSessionCompleted || pendingAddExerciseId || pendingMutation || isFinishing) return;
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
        [newSet.id]: { weightKg: "", repsDone: "" }
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
      isSessionCompleted ||
      !exercise ||
      !targetSet ||
      targetSet.isLocked ||
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
    if (isSessionCompleted || pendingMutation || savingSetIds.includes(setId) || isFinishing) {
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
                  isLocked: payload.isLocked ?? true,
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

  const handleUnlock = async (exerciseId: string, setId: string) => {
    if (isSessionCompleted || pendingMutation || savingSetIds.includes(setId) || isFinishing) {
      return;
    }

    setPendingMutation({ setId, kind: "unlock" });
    setErrorMessage(null);

    try {
      const payload = await postSetAction(setId, "unlock");
      setExercises((current) =>
        updateExerciseState(current, exerciseId, (exerciseItem) => ({
          ...exerciseItem,
          sets: exerciseItem.sets.map((set) =>
            set.id === setId
              ? {
                  ...set,
                  isCompleted: payload.isCompleted ?? false,
                  isLocked: payload.isLocked ?? false,
                  completedAt: payload.completedAt ?? null
                }
              : set
          )
        }))
      );
      updateIncompleteSetCount(1);
      setRevealedSetId((current) => (current === setId ? null : current));
      refreshTrainScreen();
    } catch (error) {
      console.error("Failed to unlock workout set.", error);
      setErrorMessage(error instanceof Error ? error.message : "ロック解除に失敗しました。");
    } finally {
      setPendingMutation(null);
    }
  };

  const handleFinish = async (forceFinish = false) => {
    if (
      isSessionCompleted ||
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
      refreshTrainScreen();
    } catch (error) {
      console.error("Failed to finish workout session.", error);
      setErrorMessage(error instanceof Error ? error.message : "セッション終了に失敗しました。");
    } finally {
      setIsFinishing(false);
    }
  };

  const openAddExerciseModal = async () => {
    if (isSessionCompleted) return;
    setIsAddExerciseModalOpen(true);
    setExerciseSearchQuery("");
    setAddExerciseError(null);
    setIsLoadingExercises(true);
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

  const closeAddExerciseModal = () => {
    setIsAddExerciseModalOpen(false);
    setExerciseSearchQuery("");
    setAddExerciseError(null);
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
        <button className={styles.iconButton} type="button">Rest</button>
        <button className={styles.iconButton} type="button">Calc</button>
        <div className={styles.timer}>00:00</div>
        <button
          className={`${styles.finishButton} ${isSessionCompleted ? styles.finishButtonCompleted : ""}`}
          disabled={
            isSessionCompleted ||
            isFinishing ||
            pendingMutation !== null ||
            pendingAddExerciseId !== null ||
            savingSetIds.length > 0
          }
          onClick={() => handleFinish()}
          type="button"
        >
          {isSessionCompleted ? "Completed" : isFinishing ? "Finishing..." : "Finish"}
        </button>
      </div>

      <section className={styles.programCard}>
        <h1 className={styles.programTitle}>今日のワークアウト</h1>
        <p className={styles.programMeta}>{session.programTitle} / {session.programWeekLabel}</p>
        <p className={styles.programNote}>{session.progressionGuide}</p>
        <p className={styles.programNote}>{session.notes}</p>
        <div className={styles.hint}>
          <span>Kg / Reps は onBlur で保存</span>
          <span>Add Set は DB 保存済み</span>
        </div>
      </section>

      {isSessionCompleted ? (
        <section className={styles.completedBanner}>
          <strong>このワークアウトは完了済みです。</strong>
          <span>{formatFinishedAt(sessionMeta.finishedAt)}</span>
          <span>未完了セット残数: {sessionMeta.incompleteSetCount}</span>
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
              <span className={styles.headerHint}>履歴へ</span>
            </div>

            <div className={styles.swipeHint}>
              左スワイプで Delete を表示します。1セット目の Kg は空欄の後続セットに自動反映されます。
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
                const isDeleteDisabled = set.isLocked || isBusy || isSessionCompleted;

                return (
                  <div className={styles.swipeRow} key={set.id}>
                    <div className={styles.deleteLane}>
                      <button
                        className={`${styles.deleteButton} ${isDeleteDisabled ? styles.deleteDisabled : ""}`}
                        disabled={isDeleteDisabled}
                        onClick={() => handleDelete(exercise.id, set.id)}
                        type="button"
                      >
                        {set.isLocked
                          ? "Unlock first"
                          : isMutating && pendingMutation?.kind === "delete"
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
                      <div className={`${styles.setRow} ${set.isLocked ? styles.lockedRow : ""}`}>
                        <span className={styles.mono}>{set.displaySetNumber}</span>
                        <span className={`${styles.mono} ${set.previousDisplay === "-" ? styles.previousEmpty : ""}`}>
                          {set.previousDisplay}
                        </span>
                        <span className={styles.target}>{set.targetRepsText ?? "-"}</span>
                        <input
                          aria-label={`${exercise.exerciseNameEn} set ${set.displaySetNumber} kg`}
                          className={`${styles.input} ${isSaving ? styles.inputSaving : ""} ${set.isAutoFilled ? styles.inputAutoFilled : ""}`}
                          disabled={set.isLocked || isSaving || isSessionCompleted}
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
                          disabled={set.isLocked || isSaving || isSessionCompleted}
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
                        {set.isLocked ? (
                          <button
                            className={`${styles.actionButton} ${styles.unlockButton}`}
                            disabled={isBusy || isSessionCompleted}
                            onClick={() => handleUnlock(exercise.id, set.id)}
                            type="button"
                          >
                            {isMutating && pendingMutation?.kind === "unlock" ? "..." : "Unlock"}
                          </button>
                        ) : (
                          <button
                            aria-label={set.isCompleted ? "completed" : "mark complete"}
                            className={`${styles.actionButton} ${styles.check} ${set.isCompleted ? styles.checkDone : ""}`}
                            disabled={isBusy || isSessionCompleted}
                            onClick={() => handleComplete(exercise.id, set.id)}
                            type="button"
                          >
                            {isMutating && pendingMutation?.kind === "complete"
                              ? "..."
                              : set.isCompleted
                                ? "✓"
                                : "○"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={styles.exerciseActions}>
              <button
                className={styles.primaryGhostButton}
                disabled={pendingAddExerciseId === exercise.id || isSessionCompleted}
                onClick={() => handleAddSet(exercise.id)}
                type="button"
              >
                {pendingAddExerciseId === exercise.id ? "Adding..." : "+ Add Set"}
              </button>
              <button className={styles.subtleButton} disabled={isSessionCompleted} type="button">
                Swap
              </button>
              <button className={styles.subtleButton} disabled={isSessionCompleted} type="button">
                ...
              </button>
            </div>
          </article>
        ))}
      </section>

      <div className={styles.footerAction}>
        <button
          className={styles.primaryGhostButton}
          disabled={isSessionCompleted}
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
              <h2 className={styles.modalTitle}>Add Exercise</h2>
              <button
                className={styles.modalCloseButton}
                onClick={closeAddExerciseModal}
                type="button"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>

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
                      onClick={() => handleAddExercise(item.id)}
                      type="button"
                    >
                      <span className={styles.modalListItemName}>{item.nameJa}</span>
                      <span className={styles.modalListItemSub}>
                        {item.nameEn}
                        {item.category ? ` · ${item.category}` : ""}
                        {isAddingExerciseId === item.id ? " — 追加中..." : ""}
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

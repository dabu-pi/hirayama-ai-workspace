"use client";

import { useState, useTransition } from "react";

import { updateExerciseParams } from "@/lib/admin/program-update";
import styles from "./ExerciseParamEditor.module.css";

const EXERCISE_TYPES = ["T1", "T2", "T3"] as const;
type ExerciseType = (typeof EXERCISE_TYPES)[number];

const TYPE_CLASS: Record<string, string> = {
  T1: styles.typeT1,
  T2: styles.typeT2,
  T3: styles.typeT3,
};

type Props = {
  exerciseId: string;
  programId: string;
  orderIndex: number;
  initialExerciseType: string;
  initialSetCount: number;
  initialTargetRepsText: string | null;
  exerciseNameJa: string;
  exerciseNameEn: string;
};

export function ExerciseParamEditor({
  exerciseId,
  programId,
  orderIndex,
  initialExerciseType,
  initialSetCount,
  initialTargetRepsText,
  exerciseNameJa,
  exerciseNameEn,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [typeInput, setTypeInput] = useState<ExerciseType>("T1");
  const [setCountInput, setSetCountInput] = useState(1);
  const [repsInput, setRepsInput] = useState("");
  const [currentType, setCurrentType] = useState(initialExerciseType);
  const [currentSetCount, setCurrentSetCount] = useState(initialSetCount);
  const [currentReps, setCurrentReps] = useState(initialTargetRepsText);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openEditor() {
    setTypeInput((EXERCISE_TYPES.includes(currentType as ExerciseType)
      ? currentType
      : "T1") as ExerciseType);
    setSetCountInput(currentSetCount);
    setRepsInput(currentReps ?? "");
    setErrorMsg(null);
    setIsEditing(true);
  }

  function closeEditor() {
    setIsEditing(false);
    setErrorMsg(null);
  }

  function handleSave() {
    const reps = repsInput.trim() || null;
    startTransition(async () => {
      const result = await updateExerciseParams(
        exerciseId,
        programId,
        typeInput,
        setCountInput,
        reps
      );
      if (result.ok) {
        setCurrentType(typeInput);
        setCurrentSetCount(setCountInput);
        setCurrentReps(reps);
        setIsEditing(false);
        setErrorMsg(null);
      } else {
        const msg =
          result.error === "forbidden"
            ? "権限がありません"
            : result.error === "exercise_not_found"
            ? "種目が見つかりません"
            : result.error === "invalid_exercise_type"
            ? "種目タイプが無効です（T1/T2/T3）"
            : result.error === "invalid_set_count"
            ? "セット数は1〜20で入力してください"
            : result.error === "reps_too_long"
            ? "rep数テキストが長すぎます（100文字以内）"
            : "保存に失敗しました";
        setErrorMsg(msg);
      }
    });
  }

  function handleEscape(e: React.KeyboardEvent) {
    if (e.key === "Escape") closeEditor();
  }

  if (isEditing) {
    return (
      <div className={styles.editContainer}>
        <div className={styles.editContext}>
          <span className={styles.exOrder}>{orderIndex}</span>
          <span className={styles.exNameFixed}>{exerciseNameJa}</span>
        </div>
        <div className={styles.editFields}>
          <select
            className={styles.typeSelect}
            value={typeInput}
            onChange={(e) => setTypeInput(e.target.value as ExerciseType)}
            disabled={isPending}
            autoFocus
            onKeyDown={handleEscape}
          >
            {EXERCISE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            type="number"
            className={styles.setCountInput}
            value={setCountInput}
            min={1}
            max={20}
            onChange={(e) => setSetCountInput(Number(e.target.value))}
            disabled={isPending}
            onKeyDown={handleEscape}
          />
          <span className={styles.setLabel}>セット ×</span>
          <input
            type="text"
            className={styles.repsInput}
            value={repsInput}
            onChange={(e) => setRepsInput(e.target.value)}
            placeholder="例: 5x5 / 8-12 / AMRAP"
            maxLength={100}
            disabled={isPending}
            onKeyDown={handleEscape}
          />
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={isPending}
            type="button"
          >
            {isPending ? "保存中…" : "保存"}
          </button>
          <button
            className={styles.cancelBtn}
            onClick={closeEditor}
            disabled={isPending}
            type="button"
          >
            キャンセル
          </button>
          {errorMsg && <span className={styles.errorText}>{errorMsg}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.displayRow}>
      <span className={styles.exOrder}>{orderIndex}</span>
      <span className={`${styles.exType} ${TYPE_CLASS[currentType] ?? styles.typeT3}`}>
        {currentType}
      </span>
      <span className={styles.exName}>
        {exerciseNameJa}
        {exerciseNameJa !== exerciseNameEn && (
          <span className={styles.exNameEn}> ({exerciseNameEn})</span>
        )}
      </span>
      <span className={styles.exSets}>
        {currentSetCount}セット
        {currentReps ? ` × ${currentReps}` : ""}
      </span>
      <button
        className={styles.editTrigger}
        onClick={openEditor}
        type="button"
        aria-label={`${exerciseNameJa}のパラメータを編集`}
      >
        編集
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";

import type { AdminProgramExerciseDetail } from "@/lib/admin/program-detail";
import { swapExerciseOrder } from "@/lib/admin/program-update";
import { ExerciseParamEditor } from "./ExerciseParamEditor";
import styles from "./ExerciseList.module.css";

type Props = {
  programId: string;
  initialExercises: AdminProgramExerciseDetail[];
};

export function ExerciseList({ programId, initialExercises }: Props) {
  const [exercises, setExercises] = useState(initialExercises);
  const [isSwapping, setIsSwapping] = useState(false);

  function handleMove(fromIndex: number, toIndex: number) {
    if (isSwapping) return;
    if (toIndex < 0 || toIndex >= exercises.length) return;

    const exA = exercises[fromIndex];
    const exB = exercises[toIndex];
    setIsSwapping(true);

    swapExerciseOrder(exA.id, exB.id, programId).then((result) => {
      setIsSwapping(false);
      if (result.ok) {
        const newList = [...exercises];
        newList[fromIndex] = { ...exB, orderIndex: exA.orderIndex };
        newList[toIndex] = { ...exA, orderIndex: exB.orderIndex };
        setExercises(newList);
      }
    });
  }

  return (
    <div className={styles.list}>
      {exercises.map((ex, i) => (
        <div key={ex.id} className={styles.itemRow}>
          <div className={styles.editorWrapper}>
            <ExerciseParamEditor
              exerciseId={ex.id}
              programId={programId}
              orderIndex={ex.orderIndex}
              initialExerciseType={ex.exerciseType}
              initialSetCount={ex.setCount}
              initialTargetRepsText={ex.targetRepsText}
              exerciseNameJa={ex.exerciseNameJa}
              exerciseNameEn={ex.exerciseNameEn}
            />
          </div>
          <div className={styles.orderBtns}>
            <button
              className={styles.moveBtn}
              onClick={() => handleMove(i, i - 1)}
              disabled={i === 0 || isSwapping}
              type="button"
              aria-label={`${ex.exerciseNameJa}を上に移動`}
            >
              ↑
            </button>
            <button
              className={styles.moveBtn}
              onClick={() => handleMove(i, i + 1)}
              disabled={i === exercises.length - 1 || isSwapping}
              type="button"
              aria-label={`${ex.exerciseNameJa}を下に移動`}
            >
              ↓
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

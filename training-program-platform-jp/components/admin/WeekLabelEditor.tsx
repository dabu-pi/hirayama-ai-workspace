"use client";

import { useState, useTransition } from "react";

import { updateProgramWeekLabel } from "@/lib/admin/program-update";
import styles from "./WeekLabelEditor.module.css";

type Props = {
  weekId: string;
  programId: string;
  weekNumber: number;
  initialLabel: string | null;
};

function formatWeekDisplay(weekNumber: number, label: string | null): string {
  const base = `${weekNumber}週目`;
  if (!label || /^Week\s*\d+$/i.test(label.trim())) return base;
  return `${base} — ${label}`;
}

export function WeekLabelEditor({ weekId, programId, weekNumber, initialLabel }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [currentLabel, setCurrentLabel] = useState(initialLabel);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openEditor() {
    setInputValue(currentLabel ?? "");
    setErrorMsg(null);
    setIsEditing(true);
  }

  function closeEditor() {
    setIsEditing(false);
    setErrorMsg(null);
  }

  function handleSave() {
    const trimmed = inputValue.trim() || null;
    startTransition(async () => {
      const result = await updateProgramWeekLabel(weekId, programId, trimmed);
      if (result.ok) {
        setCurrentLabel(trimmed);
        setIsEditing(false);
        setErrorMsg(null);
      } else {
        const msg =
          result.error === "forbidden" ? "権限がありません" :
          result.error === "week_not_found" ? "Weekが見つかりません" :
          result.error === "label_too_long" ? "ラベルが長すぎます（100文字以内）" :
          "保存に失敗しました";
        setErrorMsg(msg);
      }
    });
  }

  if (isEditing) {
    return (
      <span className={styles.editorRow}>
        <span className={styles.weekBase}>{weekNumber}週目</span>
        <input
          className={styles.labelInput}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="ラベル（例: A1 - スクワット重点）"
          maxLength={100}
          disabled={isPending}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") closeEditor();
          }}
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
      </span>
    );
  }

  return (
    <span className={styles.displayRow}>
      <span>{formatWeekDisplay(weekNumber, currentLabel)}</span>
      <button
        className={styles.editTrigger}
        onClick={openEditor}
        type="button"
        aria-label={`${weekNumber}週目のラベルを編集`}
      >
        編集
      </button>
    </span>
  );
}

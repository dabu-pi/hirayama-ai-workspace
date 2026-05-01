"use client";

import { useState, useTransition } from "react";

import { updateProgramDayInfo } from "@/lib/admin/program-update";
import styles from "./DayInfoEditor.module.css";

type Props = {
  dayId: string;
  programId: string;
  dayNumber: number;
  exerciseCount: number;
  initialProgressionGuide: string | null;
  initialNotes: string | null;
};

export function DayInfoEditor({
  dayId,
  programId,
  dayNumber,
  exerciseCount,
  initialProgressionGuide,
  initialNotes,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [guideInput, setGuideInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [currentGuide, setCurrentGuide] = useState(initialProgressionGuide);
  const [currentNotes, setCurrentNotes] = useState(initialNotes);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openEditor() {
    setGuideInput(currentGuide ?? "");
    setNotesInput(currentNotes ?? "");
    setErrorMsg(null);
    setIsEditing(true);
  }

  function closeEditor() {
    setIsEditing(false);
    setErrorMsg(null);
  }

  function handleSave() {
    const guide = guideInput.trim() || null;
    const notes = notesInput.trim() || null;
    startTransition(async () => {
      const result = await updateProgramDayInfo(dayId, programId, guide, notes);
      if (result.ok) {
        setCurrentGuide(guide);
        setCurrentNotes(notes);
        setIsEditing(false);
        setErrorMsg(null);
      } else {
        const msg =
          result.error === "forbidden"
            ? "権限がありません"
            : result.error === "day_not_found"
            ? "Dayが見つかりません"
            : result.error === "progression_guide_too_long"
            ? "進行ガイドが長すぎます（1000文字以内）"
            : result.error === "notes_too_long"
            ? "メモが長すぎます（1000文字以内）"
            : "保存に失敗しました";
        setErrorMsg(msg);
      }
    });
  }

  if (isEditing) {
    return (
      <div className={styles.editContainer}>
        <div className={styles.headingRow}>
          <span className={styles.dayTitle}>Day {dayNumber}</span>
          <span className={styles.dayMeta}>{exerciseCount}種目</span>
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>進行ガイド</label>
          <textarea
            className={styles.textarea}
            value={guideInput}
            onChange={(e) => setGuideInput(e.target.value)}
            placeholder="例: 前週より5kg増量を目指す。失敗したら同重量継続。"
            maxLength={1000}
            rows={3}
            disabled={isPending}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") closeEditor();
            }}
          />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>メモ</label>
          <textarea
            className={styles.textarea}
            value={notesInput}
            onChange={(e) => setNotesInput(e.target.value)}
            placeholder="例: 疲労が残っている場合は重量を落とすこと。"
            maxLength={1000}
            rows={2}
            disabled={isPending}
            onKeyDown={(e) => {
              if (e.key === "Escape") closeEditor();
            }}
          />
        </div>
        <div className={styles.actionRow}>
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
    <>
      <div className={styles.headingRow}>
        <span className={styles.dayTitle}>Day {dayNumber}</span>
        <span className={styles.dayMeta}>{exerciseCount}種目</span>
        <button
          className={styles.editTrigger}
          onClick={openEditor}
          type="button"
          aria-label={`Day ${dayNumber}の情報を編集`}
        >
          編集
        </button>
      </div>
      {(currentGuide || currentNotes) && (
        <div className={styles.notesDisplay}>
          {currentGuide && (
            <p className={styles.noteItem}>
              <span className={styles.noteLabel}>進行ガイド:</span>
              {currentGuide}
            </p>
          )}
          {currentNotes && (
            <p className={styles.noteItem}>
              <span className={styles.noteLabel}>メモ:</span>
              {currentNotes}
            </p>
          )}
        </div>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { createProgram } from "@/lib/admin/program-create";
import styles from "./AdminProgramNewScreen.module.css";

const ERROR_MESSAGES: Record<string, string> = {
  title_required: "プログラム名は必須です。",
  invalid_duration_weeks: "週数は 1〜52 の整数で入力してください。",
  invalid_days_per_week: "日数は 1〜7 の整数で入力してください。",
  forbidden: "権限がありません。",
  insert_failed: "登録に失敗しました。しばらく待って再試行してください。"
};

function resolveErrorMessage(code: string | undefined): string {
  if (!code) return "登録に失敗しました。";
  return ERROR_MESSAGES[code] ?? `登録に失敗しました: ${code}`;
}

export function AdminProgramNewScreen() {
  const [title, setTitle]             = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel]             = useState("");
  const [methodology, setMethodology] = useState("");
  const [isPublic, setIsPublic]       = useState(false);
  const [durationWeeks, setDurationWeeks] = useState("4");
  const [daysPerWeek, setDaysPerWeek]     = useState("3");

  const [error, setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createProgram({
        title,
        description: description.trim() || null,
        level: level || null,
        methodology: methodology || null,
        isPublic,
        durationWeeks: Number(durationWeeks),
        daysPerWeek: Number(daysPerWeek)
      });

      if (!result.ok) {
        setError(resolveErrorMessage(result.error));
        return;
      }

      window.location.assign(`/admin/programs/${result.id}`);
    });
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/admin/programs" className={styles.back}>
          ← プログラム一覧へ戻る
        </Link>
        <h1 className={styles.title}>新規プログラム登録</h1>
        <p className={styles.subtitle}>
          基本情報のみ登録します。Week / Day / Exercise は seed SQL で追加してください。
        </p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        {/* title */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="title">
            プログラム名 <span className={styles.required}>必須</span>
          </label>
          <input
            id="title"
            className={styles.input}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={isPending}
            placeholder="例: GZCLP 基礎 3日/週"
          />
        </div>

        {/* description */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="description">概要・説明</label>
          <textarea
            id="description"
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isPending}
            rows={4}
            placeholder="プログラムの概要を入力（任意）"
          />
        </div>

        {/* level + methodology */}
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="level">レベル</label>
            <select
              id="level"
              className={styles.select}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              disabled={isPending}
            >
              <option value="">未設定</option>
              <option value="beginner">初級 (beginner)</option>
              <option value="intermediate">中級 (intermediate)</option>
              <option value="advanced">上級 (advanced)</option>
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="methodology">方式 (methodology)</label>
            <select
              id="methodology"
              className={styles.select}
              value={methodology}
              onChange={(e) => setMethodology(e.target.value)}
              disabled={isPending}
            >
              <option value="">未設定</option>
              <option value="gzcl">GZCL</option>
              <option value="linear">リニア (linear)</option>
              <option value="generic">汎用 (generic)</option>
            </select>
          </div>
        </div>

        {/* duration_weeks + days_per_week */}
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="durationWeeks">期間（週）</label>
            <input
              id="durationWeeks"
              className={`${styles.input} ${styles.inputNum}`}
              type="number"
              min={1}
              max={52}
              value={durationWeeks}
              onChange={(e) => setDurationWeeks(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="daysPerWeek">頻度（日/週）</label>
            <input
              id="daysPerWeek"
              className={`${styles.input} ${styles.inputNum}`}
              type="number"
              min={1}
              max={7}
              value={daysPerWeek}
              onChange={(e) => setDaysPerWeek(e.target.value)}
              disabled={isPending}
            />
          </div>
        </div>

        {/* is_public */}
        <div className={styles.field}>
          <span className={styles.label}>公開設定</span>
          <div className={styles.radioGroup}>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="isPublic"
                value="false"
                checked={isPublic === false}
                onChange={() => setIsPublic(false)}
                disabled={isPending}
              />
              非公開（管理者のみ確認可）— 推奨: Day/Exercise 追加後に公開
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="isPublic"
                value="true"
                checked={isPublic === true}
                onChange={() => setIsPublic(true)}
                disabled={isPending}
              />
              公開（一般ユーザーに表示される）
            </label>
          </div>

          {isPublic && (
            <div className={styles.publicWarning}>
              ⚠️ 公開設定で登録すると、Day/Exercise が未登録でも /programs 一覧に表示されます。
              通常は非公開で登録し、seed 追加後に公開してください。
            </div>
          )}
        </div>

        {/* error */}
        {error && (
          <div className={styles.errorBox} role="alert">
            {error}
          </div>
        )}

        {/* actions */}
        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.saveButton}
            disabled={isPending || !title.trim()}
          >
            {isPending ? "登録中..." : "登録する"}
          </button>
          <Link href="/admin/programs" className={styles.cancelLink}>
            キャンセル
          </Link>
        </div>
      </form>
    </main>
  );
}

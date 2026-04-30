"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import type { AdminProgramDetail } from "@/lib/admin/program-detail";
import { updateProgramBasicInfo } from "@/lib/admin/program-update";
import styles from "./AdminProgramEditScreen.module.css";

type Props = {
  program: AdminProgramDetail;
};

const ERROR_MESSAGES: Record<string, string> = {
  title_required: "プログラム名は必須です。",
  invalid_duration_weeks: "週数は 1〜52 の整数で入力してください。",
  invalid_days_per_week: "日数は 1〜7 の整数で入力してください。",
  forbidden: "権限がありません。",
  program_not_found: "プログラムが見つかりませんでした。"
};

function resolveErrorMessage(code: string | undefined): string {
  if (!code) return "保存に失敗しました。";
  return ERROR_MESSAGES[code] ?? `保存に失敗しました: ${code}`;
}

export function AdminProgramEditScreen({ program }: Props) {
  const [title, setTitle]             = useState(program.title);
  const [description, setDescription] = useState(program.description ?? "");
  const [level, setLevel]             = useState(program.level ?? "");
  const [methodology, setMethodology] = useState(program.methodology ?? "");
  const [isPublic, setIsPublic]       = useState(program.isPublic);
  const [durationWeeks, setDurationWeeks] = useState(String(program.durationWeeks));
  const [daysPerWeek, setDaysPerWeek]     = useState(String(program.daysPerWeek));

  const [error, setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const willPublish = !program.isPublic && isPublic;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateProgramBasicInfo(program.id, {
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

      // Full navigation to bypass Router Cache — ensures detail page fetches fresh data
      window.location.assign(`/admin/programs/${program.id}`);
    });
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href={`/admin/programs/${program.id}`} className={styles.back}>
          ← プログラム詳細へ戻る
        </Link>
        <h1 className={styles.title}>基本情報を編集</h1>
        <p className={styles.subtitle}>{program.title}</p>
      </header>

      {/* slug display */}
      <div className={styles.slugNote}>
        <span className={styles.slugLabel}>slug（変更不可）</span>
        <code className={styles.slugCode}>{program.slug}</code>
        <span className={styles.slugHint}>
          title を変更しても slug は変わりません（既存 enrollment・URL に影響なし）
        </span>
      </div>

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
            placeholder="プログラム名を入力"
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
                value="true"
                checked={isPublic === true}
                onChange={() => setIsPublic(true)}
                disabled={isPending}
              />
              公開（一般ユーザーに表示される）
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="isPublic"
                value="false"
                checked={isPublic === false}
                onChange={() => setIsPublic(false)}
                disabled={isPending}
              />
              非公開（管理者のみ確認可）
            </label>
          </div>

          {willPublish && (
            <div className={styles.publicWarning}>
              ⚠️ このプログラムを公開すると、一般ユーザーの /programs 一覧に表示されます。
              内容を確認してから保存してください。
            </div>
          )}
          {program.isPublic && !isPublic && (
            <div className={styles.privateWarning}>
              ⚠️ 非公開に変更しても、既存の enrollment・進行中のセッションには影響しません。
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
            {isPending ? "保存中..." : "保存する"}
          </button>
          <Link
            href={`/admin/programs/${program.id}`}
            className={styles.cancelLink}
          >
            キャンセル
          </Link>
        </div>
      </form>
    </main>
  );
}

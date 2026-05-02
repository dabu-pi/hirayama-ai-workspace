"use client";

import Link from "next/link";
import { useState } from "react";

import { formatWeekDay } from "@/lib/workout/format-labels";

import styles from "./StartSessionScreen.module.css";

type StartSessionScreenProps = {
  programSlug: string;
  programTitle: string;
  programDayId: string;
  programDayLabel: string;
};

export function StartSessionScreen({
  programSlug,
  programTitle,
  programDayId,
  programDayLabel
}: StartSessionScreenProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);

  async function handleStart() {
    if (isStarting) return;
    setIsStarting(true);
    setError(null);
    setRequiresLogin(false);

    try {
      const response = await fetch("/api/workout-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ program_day_id: programDayId })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as {
          error?: { message?: string };
        };
        if (response.status === 401) {
          setRequiresLogin(true);
        }
        setIsStarting(false);
        setError(body.error?.message ?? "セッションを開始できませんでした。もう一度お試しください。");
        return;
      }

      // Hard navigation after confirmed session creation.
      // window.location.href bypasses the Next.js Router Cache that would serve
      // a stale StartSessionScreen RSC payload for the same URL.
      window.location.href = `/train?program=${encodeURIComponent(programSlug)}&programDayId=${encodeURIComponent(programDayId)}`;
    } catch {
      setIsStarting(false);
      setError("ネットワークエラーが発生しました。接続を確認してもう一度お試しください。");
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link
          className={styles.backLink}
          href={`/programs/${encodeURIComponent(programSlug)}`}
        >
          <span aria-hidden="true">&larr;</span>
          <span>プログラムへ戻る</span>
        </Link>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>{formatWeekDay(programDayLabel)}</span>
        <h1 className={styles.title}>{programTitle}</h1>
      </section>

      {error && (
        <section className={styles.errorCard}>
          <p>{error}</p>
          {requiresLogin && (
            <p>
              <Link href="/login">ログイン</Link>
              {" "}してワークアウトを開始し、進捗をアカウントに保存しましょう。
            </p>
          )}
        </section>
      )}

      <div className={styles.actions}>
        <button
          className={styles.startButton}
          disabled={isStarting}
          onClick={handleStart}
          type="button"
        >
          {isStarting ? "開始中…" : `${formatWeekDay(programDayLabel)}を開始`}
        </button>
        <Link
          className={styles.cancelLink}
          href={`/programs/${encodeURIComponent(programSlug)}`}
        >
          キャンセル
        </Link>
      </div>
    </main>
  );
}

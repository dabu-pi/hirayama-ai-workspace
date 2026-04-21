"use client";

import Link from "next/link";
import { useState } from "react";

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
        setError(body.error?.message ?? "Failed to start session. Please try again.");
        return;
      }

      // Hard navigation bypasses the Next.js Router Cache entirely.
      // router.push to the same URL (/train?...&programDayId=...) can serve a stale
      // RSC payload (StartSessionScreen) from the client-side router cache, which causes
      // the transition to appear frozen. window.location.href always fetches fresh from server.
      window.location.href = `/train?program=${encodeURIComponent(programSlug)}&programDayId=${encodeURIComponent(programDayId)}`;
    } catch {
      setIsStarting(false);
      setError("Network error. Please check your connection and try again.");
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
          <span>Back to Program</span>
        </Link>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>Start Workout</span>
        <h1 className={styles.title}>{programTitle}</h1>
        <p className={styles.dayLabel}>{programDayLabel}</p>
      </section>

      {error && (
        <section className={styles.errorCard}>
          <p>{error}</p>
          {requiresLogin && (
            <p>
              <Link href="/login">Log in</Link>
              {" "}to create your workout session and keep your progress linked to your account.
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
          {isStarting ? "開始中…" : "Start Workout"}
        </button>
        <Link
          className={styles.cancelLink}
          href={`/programs/${encodeURIComponent(programSlug)}`}
        >
          Cancel
        </Link>
      </div>
    </main>
  );
}

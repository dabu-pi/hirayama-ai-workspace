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

  function handleStart() {
    if (isStarting) return;
    setIsStarting(true);

    // Fire-and-forget: keepalive ensures POST completes even after page navigation.
    // /train renders in ~1-2s, POST completes in < 1s → session exists by the time
    // /train queries it. Error cases (401, 409, block) are handled by /train itself.
    fetch("/api/workout-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ program_day_id: programDayId }),
      keepalive: true
    }).catch(() => {});

    window.location.href = `/train?program=${encodeURIComponent(programSlug)}&programDayId=${encodeURIComponent(programDayId)}`;
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

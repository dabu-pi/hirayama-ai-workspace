"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);

  async function handleStart() {
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
        setError(body.error?.message ?? "Failed to start session. Please try again.");
        return;
      }

      // Navigate to /train without programDayId so WorkoutScreen picks up the new session
      startTransition(() => {
        router.push(`/train?program=${encodeURIComponent(programSlug)}`);
      });
    } catch {
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
          disabled={isPending}
          onClick={handleStart}
          type="button"
        >
          {isPending ? "Starting…" : "Start Workout"}
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

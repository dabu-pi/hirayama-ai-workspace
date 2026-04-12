import Link from "next/link";

import type { WorkoutSummaryState, WorkoutSummaryView } from "@/types/workout";

import styles from "./WorkoutSummaryScreen.module.css";

type WorkoutSummaryScreenProps = {
  summary: WorkoutSummaryView | null;
  state: WorkoutSummaryState;
  errorMessage?: string | null;
};

function typeClassName(exerciseType: "T1" | "T2" | "T3") {
  if (exerciseType === "T1") return `${styles.typeBadge} ${styles.typeT1}`;
  if (exerciseType === "T2") return `${styles.typeBadge} ${styles.typeT2}`;
  return `${styles.typeBadge} ${styles.typeT3}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Not recorded";
  }

  return parsed.toLocaleString("ja-JP");
}

function resolveStateTitle(state: WorkoutSummaryState) {
  if (state === "loading") return "Loading workout summary";
  if (state === "unauthenticated") return "Sign in required";
  if (state === "not_found") return "Workout summary not found";
  if (state === "not_completed") return "Workout still in progress";
  if (state === "error") return "Workout summary unavailable";
  return "Workout complete";
}

function resolveStateBody(
  state: WorkoutSummaryState,
  errorMessage: string | null | undefined
) {
  if (errorMessage) return errorMessage;
  if (state === "loading") return "Loading the latest session data...";
  if (state === "not_completed") {
    return "Finish the workout on Train to unlock the completion summary.";
  }
  if (state === "unauthenticated") {
    return "Open this page after signing in with the training account.";
  }
  if (state === "not_found") {
    return "Only sessions that belong to the signed-in user can be shown here.";
  }
  if (state === "error") {
    return "Please try again after refreshing the page.";
  }
  return null;
}

export function WorkoutSummaryScreen({
  summary,
  state,
  errorMessage = null
}: WorkoutSummaryScreenProps) {
  const isReady = state === "ready" && summary !== null;
  const showMetadata = summary !== null;
  const stateBody = resolveStateBody(state, errorMessage);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.backLink} href="/train">
          <span aria-hidden="true">&larr;</span>
          <span>Back to Train</span>
        </Link>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>
          {isReady ? "Workout Complete" : "Workout Summary"}
        </span>
        <h1 className={styles.title}>{resolveStateTitle(state)}</h1>
        {showMetadata ? (
          <>
            <p className={styles.meta}>
              {summary.programTitle} / {summary.programWeekLabel}
            </p>
            <p className={styles.subtle}>
              Finished at {formatDateTime(summary.finishedAt)}
            </p>
          </>
        ) : stateBody ? (
          <p className={styles.subtle}>{stateBody}</p>
        ) : null}
      </section>

      {showMetadata ? (
        <section className={styles.statsGrid}>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>Completed At</span>
            <strong className={styles.statValue}>
              {formatDateTime(summary.finishedAt)}
            </strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>Exercises</span>
            <strong className={styles.statValue}>{summary.exercises.length}</strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>Completed Sets</span>
            <strong className={styles.statValue}>
              {summary.totalCompletedSets} / {summary.totalVisibleSets}
            </strong>
          </article>
        </section>
      ) : null}

      {!isReady ? (
        <section className={styles.statusCard}>
          {stateBody ? <p>{stateBody}</p> : null}
        </section>
      ) : summary.exercises.length === 0 ? (
        <section className={styles.statusCard}>
          <p>No visible exercises were recorded for this completed session.</p>
        </section>
      ) : (
        <section className={styles.exerciseList}>
          {summary.exercises.map((exercise) => (
            <article className={styles.exerciseCard} key={exercise.id}>
              <div className={styles.exerciseHeader}>
                <span className={typeClassName(exercise.exerciseType)}>
                  {exercise.exerciseType}
                </span>
                <div className={styles.exerciseTitleWrap}>
                  <strong className={styles.exerciseName}>
                    {exercise.exerciseNameEn}
                  </strong>
                  <span className={styles.exerciseSub}>{exercise.exerciseNameJa}</span>
                </div>
                <span className={styles.countPill}>
                  {exercise.completedSetCount} / {exercise.totalVisibleSetCount} sets
                </span>
              </div>
            </article>
          ))}
        </section>
      )}

      <div className={styles.actions}>
        <Link className={styles.primaryAction} href="/train">
          Back to Train
        </Link>
        <Link className={styles.secondaryAction} href="/">
          Back to Home
        </Link>
      </div>
    </main>
  );
}

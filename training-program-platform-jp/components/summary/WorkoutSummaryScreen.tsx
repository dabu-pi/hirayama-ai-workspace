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

function resolveStateTitle(state: WorkoutSummaryState, isProgramCompleted: boolean) {
  if (state === "loading") return "Loading workout summary";
  if (state === "unauthenticated") return "Sign in required";
  if (state === "not_found") return "Workout summary not found";
  if (state === "not_completed") return "Workout still in progress";
  if (state === "cancelled") return "Workout cancelled";
  if (state === "error") return "Workout summary unavailable";
  if (isProgramCompleted) return "Program complete";
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
  // "cancelled" and "ready" return null — summary data renders instead
  return null;
}

export function WorkoutSummaryScreen({
  summary,
  state,
  errorMessage = null
}: WorkoutSummaryScreenProps) {
  const isReady = state === "ready" && summary !== null;
  const isCancelled = state === "cancelled" && summary !== null;
  // Show metadata (stats grid, header info) for completed and cancelled sessions
  const showMetadata = summary !== null && (isReady || isCancelled);
  // Show exercise list for completed and cancelled sessions
  const showExercises = showMetadata;
  const stateBody = resolveStateBody(state, errorMessage);
  const isProgramCompleted = summary?.isProgramCompleted ?? false;
  const nextProgramDayLabel = summary?.nextProgramDayLabel ?? null;
  const nextProgramDayId = summary?.nextProgramDayId ?? null;
  const programSlug = summary?.programSlug ?? null;
  const firstProgramDayId = summary?.firstProgramDayId ?? null;
  const nextTrainUrl =
    !isProgramCompleted && nextProgramDayId && programSlug
      ? `/train?program=${programSlug}&programDayId=${nextProgramDayId}`
      : null;
  const restartUrl =
    isProgramCompleted && firstProgramDayId && programSlug
      ? `/train?program=${programSlug}&programDayId=${firstProgramDayId}`
      : null;

  // S-6: Back link — home for normal flow, programs when program is complete
  const backHref = isProgramCompleted ? "/programs" : "/";
  const backLabel = isProgramCompleted ? "Back to Programs" : "Back to Home";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.backLink} href={backHref}>
          <span aria-hidden="true">&larr;</span>
          <span>{backLabel}</span>
        </Link>
      </header>

      {/* S-6: Cancelled banner */}
      {isCancelled && (
        <section className={styles.cancelledBanner}>
          <strong>このワークアウトはキャンセルされました。</strong>
          <span>完了済みセットのデータは履歴に保存されています。</span>
        </section>
      )}

      <section className={isCancelled ? styles.heroCancelled : isProgramCompleted ? styles.heroCompleted : styles.hero}>
        <span className={styles.eyebrow}>
          {isCancelled
            ? "Workout Cancelled"
            : isReady
              ? isProgramCompleted
                ? "Program Complete"
                : "Workout Complete"
              : "Workout Summary"}
        </span>
        <h1 className={styles.title}>{resolveStateTitle(state, isProgramCompleted)}</h1>
        {showMetadata ? (
          <>
            <p className={styles.meta}>
              {summary.programTitle} / {summary.programWeekLabel}
            </p>
            <p className={styles.subtle}>
              {isCancelled
                ? `Started at ${formatDateTime(summary.startedAt)}`
                : `Finished at ${formatDateTime(summary.finishedAt)}`}
            </p>
            {isReady && nextProgramDayLabel && (
              <div className={styles.nextUpCard}>
                <span className={styles.nextUpLabel}>Up Next</span>
                <span className={styles.nextUpValue}>{nextProgramDayLabel}</span>
              </div>
            )}
            {isReady && isProgramCompleted && (
              <div className={styles.completedCard}>
                You finished all {summary.programTitle} sessions.{" "}
                {restartUrl ? "Restart from Week 1 or choose a new program." : "Choose your next program from the library."}
              </div>
            )}
          </>
        ) : stateBody ? (
          <p className={styles.subtle}>{stateBody}</p>
        ) : null}
      </section>

      {showMetadata ? (
        <section className={styles.statsGrid}>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>{isCancelled ? "Started At" : "Completed At"}</span>
            <strong className={styles.statValue}>
              {formatDateTime(isCancelled ? summary.startedAt : summary.finishedAt)}
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
          {summary.sessionVolume !== null && (
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Session Volume</span>
              <strong className={styles.statValue}>
                {summary.sessionVolume.toLocaleString()} kg
              </strong>
            </article>
          )}
        </section>
      ) : null}

      {!showExercises ? (
        <section className={styles.statusCard}>
          {stateBody ? <p>{stateBody}</p> : null}
        </section>
      ) : summary.exercises.length === 0 ? (
        <section className={styles.statusCard}>
          <p>No visible exercises were recorded for this session.</p>
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
                  {exercise.wasSwapped && (
                    <span className={styles.swappedBadge}>Swapped this session</span>
                  )}
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
        {/* S-6: Cancelled — primary CTA is always Back to Home */}
        {isCancelled ? (
          <>
            <Link className={styles.primaryAction} href="/">
              Back to Home
            </Link>
            <Link className={styles.secondaryAction} href="/session-history">
              View all sessions
            </Link>
          </>
        ) : isProgramCompleted ? (
          <>
            {restartUrl ? (
              <Link className={styles.primaryAction} href={restartUrl}>
                Restart Program
              </Link>
            ) : (
              <Link className={styles.primaryAction} href="/programs">
                Browse Programs
              </Link>
            )}
            <Link className={styles.secondaryAction} href="/">
              Back to Home
            </Link>
            <Link className={styles.secondaryAction} href="/session-history">
              View all sessions
            </Link>
            <Link className={styles.secondaryAction} href="/programs">
              Choose Another Program
            </Link>
          </>
        ) : nextTrainUrl ? (
          <>
            <Link className={styles.primaryAction} href={nextTrainUrl}>
              Go to Next Day
            </Link>
            <Link className={styles.secondaryAction} href="/">
              Back to Home
            </Link>
            <Link className={styles.secondaryAction} href="/session-history">
              View all sessions
            </Link>
          </>
        ) : (
          <>
            <Link className={styles.primaryAction} href="/">
              Back to Home
            </Link>
            <Link className={styles.secondaryAction} href="/session-history">
              View all sessions
            </Link>
            <Link className={styles.secondaryAction} href="/programs">
              Browse Programs
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

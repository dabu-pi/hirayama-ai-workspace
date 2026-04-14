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

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.backLink} href={isProgramCompleted ? "/programs" : "/train"}>
          <span aria-hidden="true">&larr;</span>
          <span>{isProgramCompleted ? "Back to Programs" : "Back to Train"}</span>
        </Link>
      </header>

      <section className={isProgramCompleted ? styles.heroCompleted : styles.hero}>
        <span className={styles.eyebrow}>
          {isReady
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
              Finished at {formatDateTime(summary.finishedAt)}
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
        {isProgramCompleted ? (
          restartUrl ? (
            <Link className={styles.primaryAction} href={restartUrl}>
              Restart Program
            </Link>
          ) : (
            <Link className={styles.primaryAction} href="/programs">
              Browse Programs
            </Link>
          )
        ) : nextTrainUrl ? (
          <Link className={styles.primaryAction} href={nextTrainUrl}>
            Go to Next Day
          </Link>
        ) : (
          <Link className={styles.primaryAction} href="/train">
            Back to Train
          </Link>
        )}
        {isProgramCompleted && (
          <Link className={styles.secondaryAction} href="/programs">
            Choose Another Program
          </Link>
        )}
        {!isProgramCompleted && (
          <Link className={styles.secondaryAction} href="/train">
            Back to Train
          </Link>
        )}
        {!isProgramCompleted && (
          <Link className={styles.secondaryAction} href="/programs">
            Browse Programs
          </Link>
        )}
      </div>
    </main>
  );
}

import Link from "next/link";

import type { WorkoutSessionDetailView } from "@/types/workout";

import styles from "./SessionDetailScreen.module.css";

type SessionDetailScreenProps = {
  detail: WorkoutSessionDetailView | null;
  errorMessage: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not recorded";

  return parsed.toLocaleString("ja-JP");
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);

  return parsed.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function statusLabel(status: string) {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In Progress";
  return "Cancelled";
}

function statusClass(status: string, styles: Record<string, string>) {
  if (status === "completed") return `${styles.statusBadge} ${styles.statusCompleted}`;
  if (status === "in_progress") return `${styles.statusBadge} ${styles.statusInProgress}`;
  return `${styles.statusBadge} ${styles.statusCancelled}`;
}

function formatWeight(value: number | null): string {
  if (value === null) return "—";
  return `${value} kg`;
}

function formatReps(value: number | null): string {
  if (value === null) return "—";
  return String(value);
}

export function SessionDetailScreen({
  detail,
  errorMessage
}: SessionDetailScreenProps) {
  if (!detail) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <Link className={styles.backLink} href="/session-history">
            <span aria-hidden="true">&larr;</span>
            <span>Session History</span>
          </Link>
        </header>
        <section className={styles.statusCard}>
          <p>{errorMessage ?? "Session not found."}</p>
        </section>
      </main>
    );
  }

  const totalSets = detail.exercises.reduce(
    (total, exercise) => total + exercise.sets.length,
    0
  );
  const completedSets = detail.exercises.reduce(
    (total, exercise) =>
      total + exercise.sets.filter((set) => set.isCompleted).length,
    0
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.backLink} href="/session-history">
          <span aria-hidden="true">&larr;</span>
          <span>Session History</span>
        </Link>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>Session Detail</span>
        <h1 className={styles.title}>{formatDate(detail.startedAt)}</h1>
        {detail.programWeekDayLabel && (
          <p className={styles.meta}>{detail.programWeekDayLabel}</p>
        )}
        <div className={styles.badges}>
          <span className={statusClass(detail.status, styles)}>
            {statusLabel(detail.status)}
          </span>
        </div>
      </section>

      <section className={styles.statsGrid}>
        <article className={styles.statCard}>
          <span className={styles.statLabel}>Started</span>
          <strong className={styles.statValue}>{formatDateTime(detail.startedAt)}</strong>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statLabel}>Finished</span>
          <strong className={styles.statValue}>{formatDateTime(detail.finishedAt)}</strong>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statLabel}>Sets Done</span>
          <strong className={styles.statValue}>
            {completedSets} / {totalSets}
          </strong>
        </article>
      </section>

      {detail.exercises.length === 0 ? (
        <section className={styles.statusCard}>
          <p>No exercises were recorded for this session.</p>
        </section>
      ) : (
        <section className={styles.exerciseList}>
          {detail.exercises.map((exercise) => (
            <article className={styles.exerciseCard} key={exercise.id}>
              <div className={styles.exerciseHeader}>
                <span className={`${styles.typeBadge} ${styles[`type${exercise.exerciseType}`]}`}>
                  {exercise.exerciseType}
                </span>
                <div className={styles.exerciseTitleWrap}>
                  <strong className={styles.exerciseName}>
                    {exercise.exerciseNameEn}
                  </strong>
                  <span className={styles.exerciseSub}>{exercise.exerciseNameJa}</span>
                  {exercise.wasSwapped && (
                    <span className={styles.swappedBadge}>Swapped</span>
                  )}
                  {exercise.wasAdded && (
                    <span className={styles.addedBadge}>Added</span>
                  )}
                </div>
              </div>

              {exercise.sets.length === 0 ? (
                <p className={styles.noSets}>No sets recorded.</p>
              ) : (
                <table className={styles.setTable}>
                  <thead>
                    <tr>
                      <th className={styles.colSet}>#</th>
                      <th className={styles.colKg}>Kg</th>
                      <th className={styles.colReps}>Reps</th>
                      <th className={styles.colDone}>Done</th>
                      {exercise.sets.some((set) => set.note) && (
                        <th className={styles.colNote}>Note</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {exercise.sets.map((set) => (
                      <tr
                        key={set.id}
                        className={set.isCompleted ? styles.rowCompleted : styles.rowIncomplete}
                      >
                        <td className={styles.colSet}>{set.setNumber}</td>
                        <td className={styles.colKg}>{formatWeight(set.weightKg)}</td>
                        <td className={styles.colReps}>{formatReps(set.repsDone)}</td>
                        <td className={styles.colDone}>
                          {set.isCompleted ? (
                            <span className={styles.checkmark} aria-label="Completed">✓</span>
                          ) : (
                            <span className={styles.dash} aria-label="Not completed">—</span>
                          )}
                        </td>
                        {exercise.sets.some((s) => s.note) && (
                          <td className={styles.colNote}>{set.note || ""}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </article>
          ))}
        </section>
      )}

      <div className={styles.actions}>
        <Link className={styles.secondaryAction} href="/session-history">
          Back to History
        </Link>
      </div>
    </main>
  );
}

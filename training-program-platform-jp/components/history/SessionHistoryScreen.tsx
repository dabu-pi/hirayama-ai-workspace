import Link from "next/link";

import type { WorkoutSessionListItem } from "@/types/workout";

import styles from "./SessionHistoryScreen.module.css";

type SessionHistoryScreenProps = {
  sessions: WorkoutSessionListItem[];
  errorMessage?: string | null;
};

function statusLabel(status: WorkoutSessionListItem["status"]) {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In Progress";
  return "Cancelled";
}

function statusClassName(status: WorkoutSessionListItem["status"]) {
  if (status === "completed") return `${styles.statusBadge} ${styles.statusCompleted}`;
  if (status === "in_progress") return `${styles.statusBadge} ${styles.statusInProgress}`;
  return `${styles.statusBadge} ${styles.statusCancelled}`;
}

export function SessionHistoryScreen({
  sessions,
  errorMessage = null
}: SessionHistoryScreenProps) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleWrap}>
          <span className={styles.eyebrow}>Workout History</span>
          <h1 className={styles.title}>Recent Sessions</h1>
        </div>
      </header>

      {errorMessage ? (
        <section className={`${styles.statusCard} ${styles.errorCard}`}>
          <p>{errorMessage}</p>
        </section>
      ) : sessions.length === 0 ? (
        <section className={styles.statusCard}>
          <p className={styles.emptyTitle}>No sessions yet</p>
          <p className={styles.emptyBody}>
            Complete a workout from{" "}
            <Link className={styles.inlineLink} href="/train">
              Train
            </Link>{" "}
            and it will appear here.
          </p>
        </section>
      ) : (
        <section className={styles.list}>
          {sessions.map((session) => (
            <article className={styles.card} key={session.sessionId}>
              <div className={styles.cardTop}>
                <span className={styles.date}>{session.startedAt}</span>
                <span className={statusClassName(session.status)}>
                  {statusLabel(session.status)}
                </span>
              </div>

              <div className={styles.cardMeta}>
                {session.programTitle ? (
                  <span className={styles.programTitle}>{session.programTitle}</span>
                ) : (
                  <span className={styles.programTitleNone}>Free session</span>
                )}
                {session.programWeekDayLabel && (
                  <span className={styles.weekDay}>{session.programWeekDayLabel}</span>
                )}
              </div>

              <div className={styles.cardBottom}>
                <span className={styles.exerciseCount}>
                  {session.exerciseCount === 0
                    ? "No exercises recorded"
                    : session.exerciseCount === 1
                      ? "1 exercise"
                      : `${session.exerciseCount} exercises`}
                </span>
                <div className={styles.cardLinks}>
                  {session.status === "completed" && (
                    <Link
                      className={styles.summaryLink}
                      href={`/workout-summary/${session.sessionId}`}
                    >
                      Summary →
                    </Link>
                  )}
                  <Link
                    className={styles.detailLink}
                    href={`/session-history/${session.sessionId}`}
                  >
                    Detail →
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

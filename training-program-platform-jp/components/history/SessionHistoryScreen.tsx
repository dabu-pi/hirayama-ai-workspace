import Link from "next/link";

import type { CalendarDayEntry, WorkoutSessionListItem } from "@/types/workout";

import { ArchiveSessionButton } from "./ArchiveSessionButton";
import { TrainingCalendar } from "./TrainingCalendar";
import styles from "./SessionHistoryScreen.module.css";

type SessionHistoryScreenProps = {
  sessions: WorkoutSessionListItem[];
  /** H-2: lightweight calendar entries for the current month. */
  calendarEntries: CalendarDayEntry[];
  errorMessage?: string | null;
};

function statusLabel(status: WorkoutSessionListItem["status"]) {
  if (status === "completed") return "完了";
  if (status === "in_progress") return "進行中";
  return "キャンセル済";
}

function statusClassName(status: WorkoutSessionListItem["status"]) {
  if (status === "completed") return `${styles.statusBadge} ${styles.statusCompleted}`;
  if (status === "in_progress") return `${styles.statusBadge} ${styles.statusInProgress}`;
  return `${styles.statusBadge} ${styles.statusCancelled}`;
}

export function SessionHistoryScreen({
  sessions,
  calendarEntries,
  errorMessage = null
}: SessionHistoryScreenProps) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleWrap}>
          <span className={styles.eyebrow}>トレーニング履歴</span>
          <h1 className={styles.title}>セッション一覧</h1>
        </div>
      </header>

      <TrainingCalendar entries={calendarEntries} />

      {errorMessage ? (
        <section className={`${styles.statusCard} ${styles.errorCard}`}>
          <p>{errorMessage}</p>
        </section>
      ) : sessions.length === 0 ? (
        <section className={styles.statusCard}>
          <p className={styles.emptyTitle}>セッションがまだありません</p>
          <p className={styles.emptyBody}>
            <Link className={styles.inlineLink} href="/train">
              トレーニング
            </Link>
            {" "}を完了するとここに表示されます。
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
                  <span className={styles.programTitleNone}>フリーセッション</span>
                )}
                {session.programWeekDayLabel && (
                  <span className={styles.weekDay}>{session.programWeekDayLabel}</span>
                )}
              </div>

              <div className={styles.cardBottom}>
                <span className={styles.exerciseCount}>
                  {session.exerciseCount === 0
                    ? "種目の記録なし"
                    : `${session.exerciseCount}種目`}
                </span>
                <div className={styles.cardLinks}>
                  {session.status === "completed" && (
                    <Link
                      className={styles.summaryLink}
                      href={`/workout-summary/${session.sessionId}`}
                    >
                      サマリー →
                    </Link>
                  )}
                  <Link
                    className={styles.detailLink}
                    href={`/session-history/${session.sessionId}`}
                  >
                    詳細 →
                  </Link>
                  <ArchiveSessionButton sessionId={session.sessionId} />
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

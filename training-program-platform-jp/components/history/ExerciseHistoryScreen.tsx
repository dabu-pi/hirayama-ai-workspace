import Link from "next/link";

import type { ExerciseHistoryView } from "@/types/workout";

import styles from "./ExerciseHistoryScreen.module.css";

type ExerciseHistoryScreenProps = {
  history: ExerciseHistoryView;
  errorMessage?: string | null;
  isLoading?: boolean;
};

function typeClassName(exerciseType: "T1" | "T2" | "T3") {
  if (exerciseType === "T1") return `${styles.typeBadge} ${styles.typeT1}`;
  if (exerciseType === "T2") return `${styles.typeBadge} ${styles.typeT2}`;
  return `${styles.typeBadge} ${styles.typeT3}`;
}

const EXERCISE_TYPE_BADGE: Record<"T1" | "T2" | "T3", string> = {
  T1: "T1（メイン種目）",
  T2: "T2（補助種目）",
  T3: "T3（ボリューム）"
};

export function ExerciseHistoryScreen({
  history,
  errorMessage = null,
  isLoading = false
}: ExerciseHistoryScreenProps) {
  const latestSession = !isLoading && !errorMessage ? history.sessions[0] : null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.backLink} href="/train">
          <span aria-hidden="true">←</span>
          <span>戻る</span>
        </Link>
        <div className={styles.titleWrap}>
          <div className={styles.titleLine}>
            <span className={typeClassName(history.exerciseType)}>
              {EXERCISE_TYPE_BADGE[history.exerciseType]}
            </span>
            <h1 className={styles.title}>{history.exerciseNameEn}</h1>
          </div>
          <p className={styles.subtitle}>
            完了セットを新しい順に表示しています。
          </p>
        </div>
      </header>

      {latestSession ? (
        <section className={styles.summaryCard}>
          <div className={styles.summaryLabel}>最新セッション</div>
          <div className={styles.summaryValue}>
            {latestSession.sessionDate} / {latestSession.programLabel}
          </div>
        </section>
      ) : null}

      {isLoading ? (
        <section
          aria-busy="true"
          aria-live="polite"
          className={`${styles.emptyCard} ${styles.statusCard}`}
        >
          <p>読み込み中...</p>
        </section>
      ) : errorMessage ? (
        <section
          aria-live="polite"
          className={`${styles.emptyCard} ${styles.statusCard} ${styles.errorCard}`}
        >
          <p>{errorMessage}</p>
        </section>
      ) : history.sessions.length === 0 ? (
        <section className={styles.emptyCard}>
          <p>この種目の完了セッションがまだありません。</p>
          <p>
            完了セットが記録されると、ここに新しい順で表示されます。
          </p>
        </section>
      ) : (
        <section className={styles.historyList}>
          {history.sessions.map((session) => (
            <article className={styles.historyCard} key={session.sessionId}>
              <div className={styles.historyCardHeader}>
                <span className={styles.historyDate}>{session.sessionDate}</span>
                <span className={styles.historyProgram}>
                  {session.programLabel}
                </span>
              </div>

              <div className={styles.historyTable}>
                <div className={styles.historyHeader}>
                  <span>#</span>
                  <span>Kg</span>
                  <span>Reps</span>
                  <span>メモ</span>
                </div>
                {session.sets.map((set) => (
                  <div
                    className={styles.historyRow}
                    key={`${session.sessionId}-${set.setNumber}-${set.weightKg ?? "null"}-${set.repsDone ?? "null"}-${set.note}`}
                  >
                    <span>{set.setNumber}</span>
                    <span>{set.weightKg ?? "-"}kg</span>
                    <span>{set.repsDone ?? "-"}</span>
                    <span
                      className={
                        set.note === "AMRAP" ? styles.historyNoteAmrap : undefined
                      }
                    >
                      {set.note || "-"}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

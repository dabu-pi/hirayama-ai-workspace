import Link from "next/link";

import type { ExerciseHistoryView } from "@/types/workout";

import styles from "./ExerciseHistoryScreen.module.css";

type ExerciseHistoryScreenProps = {
  history: ExerciseHistoryView;
};

function typeClassName(exerciseType: "T1" | "T2" | "T3") {
  if (exerciseType === "T1") return `${styles.typeBadge} ${styles.typeT1}`;
  if (exerciseType === "T2") return `${styles.typeBadge} ${styles.typeT2}`;
  return `${styles.typeBadge} ${styles.typeT3}`;
}

export function ExerciseHistoryScreen({
  history
}: ExerciseHistoryScreenProps) {
  const latestSession = history.sessions[0];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.backLink} href="/train">
          <span aria-hidden="true">‹</span>
          <span>戻る</span>
        </Link>
        <div className={styles.titleWrap}>
          <div className={styles.titleLine}>
            <span className={typeClassName(history.exerciseType)}>
              {history.exerciseType}
            </span>
            <h1 className={styles.title}>{history.exerciseNameEn}</h1>
          </div>
          <p className={styles.subtitle}>
            種目単体履歴のダミー表示。今後は
            {" "}
            <code>GET /exercises/{`{id}`}/history</code>
            {" "}
            相当の実データへ接続する。
          </p>
        </div>
      </header>

      {latestSession ? (
        <section className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Latest Session</div>
          <div className={styles.summaryValue}>
            {latestSession.sessionDate} / {latestSession.programLabel}
          </div>
        </section>
      ) : null}

      {history.sessions.length === 0 ? (
        <section className={styles.emptyCard}>
          <p>この種目はまだ履歴がありません。</p>
          <p>初回入力後に Previous（前回記録）の材料として表示されます。</p>
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
                  <span>Note</span>
                </div>
                {session.sets.map((set) => (
                  <div className={styles.historyRow} key={set.setNumber}>
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

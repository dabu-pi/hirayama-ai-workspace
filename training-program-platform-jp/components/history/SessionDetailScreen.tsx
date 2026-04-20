import Link from "next/link";

import type { WorkoutSessionDetailView } from "@/types/workout";

import styles from "./SessionDetailScreen.module.css";

type SessionDetailScreenProps = {
  detail: WorkoutSessionDetailView | null;
  errorMessage: string | null;
};

const EXERCISE_TYPE_BADGE: Record<"T1" | "T2" | "T3", string> = {
  T1: "T1（メイン種目）",
  T2: "T2（補助種目）",
  T3: "T3（ボリューム）"
};

function formatDateTime(value: string | null) {
  if (!value) return "記録なし";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "記録なし";

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
  if (status === "completed") return "完了";
  if (status === "in_progress") return "進行中";
  return "キャンセル";
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
            <span>セッション履歴</span>
          </Link>
        </header>
        <section className={styles.statusCard}>
          <p>{errorMessage ?? "セッションが見つかりません。"}</p>
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
          <span>セッション履歴</span>
        </Link>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>セッション詳細</span>
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
          <span className={styles.statLabel}>開始</span>
          <strong className={styles.statValue}>{formatDateTime(detail.startedAt)}</strong>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statLabel}>終了</span>
          <strong className={styles.statValue}>{formatDateTime(detail.finishedAt)}</strong>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statLabel}>完了セット</span>
          <strong className={styles.statValue}>
            {completedSets} / {totalSets}
          </strong>
        </article>
      </section>

      {detail.exercises.length === 0 ? (
        <section className={styles.statusCard}>
          <p>このセッションには記録された種目がありません。</p>
        </section>
      ) : (
        <section className={styles.exerciseList}>
          {detail.exercises.map((exercise) => (
            <article className={styles.exerciseCard} key={exercise.id}>
              <div className={styles.exerciseHeader}>
                <span className={`${styles.typeBadge} ${styles[`type${exercise.exerciseType}`]}`}>
                  {EXERCISE_TYPE_BADGE[exercise.exerciseType as "T1" | "T2" | "T3"] ?? exercise.exerciseType}
                </span>
                <div className={styles.exerciseTitleWrap}>
                  <strong className={styles.exerciseName}>
                    {exercise.exerciseNameEn}
                  </strong>
                  <span className={styles.exerciseSub}>{exercise.exerciseNameJa}</span>
                  {exercise.wasSwapped && (
                    <span className={styles.swappedBadge}>置換済</span>
                  )}
                  {exercise.wasAdded && (
                    <span className={styles.addedBadge}>追加済</span>
                  )}
                </div>
              </div>

              {exercise.sets.length === 0 ? (
                <p className={styles.noSets}>セットが記録されていません。</p>
              ) : (
                <table className={styles.setTable}>
                  <thead>
                    <tr>
                      <th className={styles.colSet}>#</th>
                      <th className={styles.colKg}>Kg</th>
                      <th className={styles.colReps}>Reps</th>
                      <th className={styles.colDone}>完</th>
                      {exercise.sets.some((set) => set.note) && (
                        <th className={styles.colNote}>メモ</th>
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
          履歴へ戻る
        </Link>
      </div>
    </main>
  );
}

import Link from "next/link";

import styles from "./BlockedSessionScreen.module.css";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type BlockedSessionScreenProps = {
  programSlug: string;
  programTitle: string;
  /** e.g. "Week 2 / Day 3" — the day that is currently in progress */
  blockedByDayLabel: string | null;
  /** program_day_id of the blocking session — used to build the resume URL */
  blockedByProgramDayId: string | null;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * S-3: Shown when the user tries to start a new day but a different day's
 * in-progress session already exists for the same enrollment.
 *
 * The only CTA is "Resume current workout" — no "start anyway" option.
 */
export function BlockedSessionScreen({
  programSlug,
  programTitle,
  blockedByDayLabel,
  blockedByProgramDayId
}: BlockedSessionScreenProps) {
  const dayLabel = blockedByDayLabel ?? "別の日";

  const resumeUrl =
    blockedByProgramDayId
      ? `/train?program=${encodeURIComponent(programSlug)}&programDayId=${encodeURIComponent(blockedByProgramDayId)}`
      : `/train?program=${encodeURIComponent(programSlug)}`;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link
          className={styles.backLink}
          href={`/programs/${encodeURIComponent(programSlug)}`}
        >
          <span aria-hidden="true">&larr;</span>
          <span>プログラムへ戻る</span>
        </Link>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>トレーニング進行中</span>
        <h1 className={styles.title}>{programTitle}</h1>
        <p className={styles.body}>
          <strong className={styles.dayHighlight}>{dayLabel}</strong>
          {" "}のセッションが未完了です。
          新しいセッションを開始する前に完了またはキャンセルしてください。
        </p>
      </section>

      <div className={styles.actions}>
        <Link className={styles.resumeButton} href={resumeUrl}>
          {dayLabel}を再開
        </Link>
        <Link
          className={styles.homeLink}
          href="/"
        >
          ホームへ戻る
        </Link>
      </div>
    </main>
  );
}

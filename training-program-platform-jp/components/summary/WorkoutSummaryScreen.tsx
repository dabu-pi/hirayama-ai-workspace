import Link from "next/link";

import type { WorkoutSummaryState, WorkoutSummaryView } from "@/types/workout";

import { RestartProgramButton } from "./RestartProgramButton";
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

const EXERCISE_TYPE_BADGE: Record<"T1" | "T2" | "T3", string> = {
  T1: "T1（メイン種目）",
  T2: "T2（補助種目）",
  T3: "T3（ボリューム）"
};

function formatDateTime(value: string | null) {
  if (!value) return "記録なし";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "記録なし";
  }

  return parsed.toLocaleString("ja-JP");
}

function resolveStateTitle(state: WorkoutSummaryState, isProgramCompleted: boolean) {
  if (state === "loading") return "読み込み中...";
  if (state === "unauthenticated") return "ログインが必要です";
  if (state === "not_found") return "サマリーが見つかりません";
  if (state === "not_completed") return "ワークアウトはまだ進行中です";
  if (state === "cancelled") return "ワークアウトがキャンセルされました";
  if (state === "error") return "サマリーを表示できません";
  if (isProgramCompleted) return "プログラム完了！";
  return "ワークアウト完了！";
}

function resolveStateBody(
  state: WorkoutSummaryState,
  errorMessage: string | null | undefined
) {
  if (errorMessage) return errorMessage;
  if (state === "loading") return "最新セッションデータを読み込み中...";
  if (state === "not_completed") {
    return "トレーニング画面でワークアウトを完了するとサマリーが表示されます。";
  }
  if (state === "unauthenticated") {
    return "トレーニングアカウントでログイン後、このページを開いてください。";
  }
  if (state === "not_found") {
    return "ログインユーザーのセッションのみ表示できます。";
  }
  if (state === "error") {
    return "ページを更新してから再試行してください。";
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
  const programId = summary?.programId ?? null;
  const nextTrainUrl =
    !isProgramCompleted && nextProgramDayId && programSlug
      ? `/train?program=${programSlug}&programDayId=${nextProgramDayId}`
      : null;
  // S-7: Restart Program CTA uses the dedicated API. The fallback URL is
  // retained so the UI can still offer a link-based flow if programId is
  // unavailable (e.g. older summary payloads without S-7 fields).
  const canRestartViaApi = isProgramCompleted && programId !== null;
  const restartFallbackUrl =
    isProgramCompleted && firstProgramDayId && programSlug
      ? `/train?program=${programSlug}&programDayId=${firstProgramDayId}`
      : null;
  const hasRestartCta = canRestartViaApi || restartFallbackUrl !== null;

  // Back link — Train for normal flow, Programs when program is complete
  const backHref = isProgramCompleted ? "/programs" : "/train";
  const backLabel = isProgramCompleted ? "プログラムへ戻る" : "トレーニングへ戻る";

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
            ? "キャンセル済み"
            : isReady
              ? isProgramCompleted
                ? "プログラム完了"
                : "ワークアウト完了"
              : "ワークアウトまとめ"}
        </span>
        <h1 className={styles.title}>{resolveStateTitle(state, isProgramCompleted)}</h1>
        {showMetadata ? (
          <>
            <p className={styles.meta}>
              {summary.programTitle} / {summary.programWeekLabel}
            </p>
            <p className={styles.subtle}>
              {isCancelled
                ? `開始: ${formatDateTime(summary.startedAt)}`
                : `完了: ${formatDateTime(summary.finishedAt)}`}
            </p>
            {isReady && nextProgramDayLabel && (
              <div className={styles.nextUpCard}>
                <span className={styles.nextUpLabel}>次のワークアウト</span>
                <span className={styles.nextUpValue}>{nextProgramDayLabel}</span>
              </div>
            )}
            {isReady && isProgramCompleted && (
              <div className={styles.completedCard}>
                {summary.programTitle}のすべてのセッションが完了しました。{" "}
                {hasRestartCta ? "Week 1から再スタートするか、新しいプログラムを選んでください。" : "ライブラリから次のプログラムを選んでください。"}
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
            <span className={styles.statLabel}>{isCancelled ? "開始時刻" : "完了時刻"}</span>
            <strong className={styles.statValue}>
              {formatDateTime(isCancelled ? summary.startedAt : summary.finishedAt)}
            </strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>種目数</span>
            <strong className={styles.statValue}>{summary.exercises.length}</strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>完了セット</span>
            <strong className={styles.statValue}>
              {summary.totalCompletedSets} / {summary.totalVisibleSets}
            </strong>
          </article>
          {summary.sessionVolume !== null && (
            <article className={styles.statCard}>
              <span className={styles.statLabel}>総ボリューム</span>
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
          <p>このセッションには記録された種目がありません。</p>
        </section>
      ) : (
        <section className={styles.exerciseList}>
          {summary.exercises.map((exercise) => (
            <article className={styles.exerciseCard} key={exercise.id}>
              <div className={styles.exerciseHeader}>
                <span className={typeClassName(exercise.exerciseType)}>
                  {EXERCISE_TYPE_BADGE[exercise.exerciseType]}
                </span>
                <div className={styles.exerciseTitleWrap}>
                  <strong className={styles.exerciseName}>
                    {exercise.exerciseNameEn}
                  </strong>
                  <span className={styles.exerciseSub}>{exercise.exerciseNameJa}</span>
                  {exercise.wasSwapped && (
                    <span className={styles.swappedBadge}>このセッションで置換</span>
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
            <Link className={styles.primaryAction} href="/train">
              トレーニングへ戻る
            </Link>
            <Link className={styles.secondaryAction} href="/session-history">
              全セッション
            </Link>
          </>
        ) : isProgramCompleted ? (
          <>
            {/* S-7: preferred path — dedicated restart API, navigates to Home */}
            {canRestartViaApi && programId ? (
              <RestartProgramButton
                className={styles.primaryAction}
                programId={programId}
              >
                プログラムを最初から
              </RestartProgramButton>
            ) : restartFallbackUrl ? (
              /* Fallback for older payloads without programId — link-based flow via /train */
              <Link className={styles.primaryAction} href={restartFallbackUrl}>
                プログラムを最初から
              </Link>
            ) : (
              <Link className={styles.primaryAction} href="/programs">
                プログラム一覧
              </Link>
            )}
            <Link className={styles.secondaryAction} href="/train">
              トレーニングへ戻る
            </Link>
            <Link className={styles.secondaryAction} href="/session-history">
              全セッション
            </Link>
            <Link className={styles.secondaryAction} href="/programs">
              別のプログラムを選ぶ
            </Link>
          </>
        ) : nextTrainUrl ? (
          <>
            <Link className={styles.primaryAction} href={nextTrainUrl}>
              次のワークアウトへ
            </Link>
            <Link className={styles.secondaryAction} href="/train">
              トレーニングへ戻る
            </Link>
            <Link className={styles.secondaryAction} href="/session-history">
              全セッション
            </Link>
          </>
        ) : (
          <>
            <Link className={styles.primaryAction} href="/train">
              トレーニングへ戻る
            </Link>
            <Link className={styles.secondaryAction} href="/session-history">
              全セッション
            </Link>
            <Link className={styles.secondaryAction} href="/programs">
              プログラム一覧
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

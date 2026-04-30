import Link from "next/link";

import type {
  ProgramDetailState,
  ProgramDetailView,
  ProgramTag,
  ProgramTagAxis,
  WeekPreview
} from "@/types/programs";
import {
  formatProgramTagLabel,
  formatProgramTitle,
  formatProgramGoal,
  formatProgramOverview,
  formatProgramWeekLabel
} from "@/lib/workout/format-labels";
import { ProgramSwitchButton } from "@/components/programs/ProgramSwitchButton";

import styles from "./ProgramDetailScreen.module.css";

const REQUIRED_TAG_AXES: ProgramTagAxis[] = ["goal", "equipment", "split"];

function findFirstTagByAxis(tags: ProgramTag[], axis: ProgramTagAxis) {
  return tags.find((tag) => tag.axis === axis) ?? null;
}

function getRequiredTags(tags: ProgramTag[]) {
  return REQUIRED_TAG_AXES.flatMap((axis) => {
    const tag = findFirstTagByAxis(tags, axis);
    return tag ? [tag] : [];
  });
}

function getOptionalFocusTag(tags: ProgramTag[]) {
  return findFirstTagByAxis(tags, "focus");
}

function WeekPreviewSection({ weekPreviews }: { weekPreviews: WeekPreview[] }) {
  if (weekPreviews.length === 0) return null;
  return (
    <section className={styles.weekPreview}>
      <span className={styles.sectionLabel}>プログラム構成</span>
      <div className={styles.weekList}>
        {weekPreviews.map((week) => (
          <div key={week.weekNumber} className={styles.weekBlock}>
            <p className={styles.weekHeading}>
              {formatProgramWeekLabel(week.weekNumber, week.label)}
            </p>
            <ol className={styles.dayList}>
              {week.days.map((day) => (
                <li key={day.dayNumber} className={styles.dayRow}>
                  <span className={styles.dayLabel}>{day.dayNumber}日目</span>
                  <span className={styles.exerciseNames}>
                    {day.exercises.map((ex) => ex.nameJa ?? ex.nameEn).join(" · ")}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

type AnyActiveEnrollment = {
  title: string;
  continueUrl: string;
  programSlug: string;
  currentWeekDayLabel: string | null;
};

type ProgramDetailScreenProps = {
  state: ProgramDetailState;
  view: ProgramDetailView;
  errorMessage?: string | null;
  /** Any active enrollment the user currently has (may be a different program). */
  anyActiveEnrollment?: AnyActiveEnrollment | null;
};

function formatSourceLabel(source: ProgramDetailView["source"]) {
  return source === "supabase" ? "Supabase" : "mock catalog";
}

function resolveTitle(state: ProgramDetailState, programTitle: string | null) {
  if (state === "loading") return "プログラム読み込み中";
  if (state === "not_found") return "プログラムが見つかりません";
  if (state === "error") return "プログラムが利用できません";
  return programTitle ?? "プログラム詳細";
}

function resolveBody(
  state: ProgramDetailState,
  errorMessage: string | null | undefined
) {
  if (errorMessage) return errorMessage;
  if (state === "loading") return "選択したプログラムの詳細を準備中...";
  if (state === "not_found") {
    return "このプログラムは現在のカタログにありません。";
  }
  if (state === "error") {
    return "ページを更新してから再試行してください。";
  }
  return "プログラムの内容を確認して、準備ができたらトレーニングを始めましょう。";
}

export function ProgramDetailScreen({
  state,
  view,
  errorMessage = null,
  anyActiveEnrollment = null
}: ProgramDetailScreenProps) {
  const program = view.program;
  const isReady = state === "ready" && program !== null;
  const bodyText = resolveBody(state, errorMessage);

  function buildTrainHref() {
    if (!isReady) return "/train";
    const params = new URLSearchParams({ program: program.slug });
    if (view.startProgramDayId) {
      params.set("programDayId", view.startProgramDayId);
    }
    return `/train?${params.toString()}`;
  }

  const trainHref = buildTrainHref();

  // Enrollment state classification
  // - "this": user is already enrolled in THIS program → CTA = "Resume"
  // - "other": user is enrolled in a DIFFERENT program → show warning
  // - "none": no active enrollment
  const enrollmentState =
    view.hasActiveEnrollment
      ? "this"
      : anyActiveEnrollment && isReady && anyActiveEnrollment.programSlug !== program?.slug
        ? "other"
        : "none";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.backLink} href="/programs">
          <span aria-hidden="true">&larr;</span>
          <span>プログラムへ戻る</span>
        </Link>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>プログラム詳細</span>
        <h1 className={styles.title}>
          {resolveTitle(state, isReady && program ? formatProgramTitle(program.slug, program.title) : program?.title ?? null)}
        </h1>
        <p className={styles.lead}>{bodyText}</p>
        <div className={styles.heroMeta}>
          <span>Source: {formatSourceLabel(view.source)}</span>
          <Link className={styles.trainLink} href={trainHref}>
            トレーニングへ
          </Link>
        </div>
      </section>

      {!isReady ? (
        <section className={styles.statusCard}>
          <p>{bodyText}</p>
        </section>
      ) : (
        <>
          <section className={styles.metaGrid}>
            <article className={styles.metaCard}>
              <span className={styles.metaLabel}>レベル</span>
              <strong className={styles.metaValue}>
                {program.level ?? "レベル未設定"}
              </strong>
            </article>
            <article className={styles.metaCard}>
              <span className={styles.metaLabel}>頻度</span>
              <strong className={styles.metaValue}>
                {program.frequencyLabel ?? "頻度未設定"}
              </strong>
            </article>
            <article className={styles.metaCard}>
              <span className={styles.metaLabel}>期間</span>
              <strong className={styles.metaValue}>
                {program.durationLabel ?? "期間未設定"}
              </strong>
            </article>
          </section>

          {(() => {
            const requiredTags = getRequiredTags(program.tags);
            const focusTag = getOptionalFocusTag(program.tags);
            if (requiredTags.length === 0 && !focusTag) return null;
            return (
              <div className={styles.tagRow}>
                {requiredTags.map((tag) => (
                  <span className={styles.tagBadge} key={tag.slug}>
                    {formatProgramTagLabel(tag.slug, tag.label)}
                  </span>
                ))}
                {focusTag ? (
                  <span className={styles.focusBadge}>{formatProgramTagLabel(focusTag.slug, focusTag.label)}</span>
                ) : null}
              </div>
            );
          })()}

          <section className={styles.contentCard}>
            <span className={styles.sectionLabel}>目標</span>
            <p className={styles.bodyCopy}>{formatProgramGoal(program.slug, program.goal) ?? "目標未設定"}</p>
          </section>

          <section className={styles.contentCard}>
            <span className={styles.sectionLabel}>概要</span>
            <p className={styles.bodyCopy}>{formatProgramOverview(program.slug, program.overview)}</p>
          </section>

          <WeekPreviewSection weekPreviews={view.weekPreviews} />
        </>
      )}

      {enrollmentState === "this" && anyActiveEnrollment?.currentWeekDayLabel && (
        <div className={styles.nextWorkoutBanner} role="status">
          <span className={styles.nextWorkoutLabel}>次のワークアウト</span>
          <span className={styles.nextWorkoutDay}>{anyActiveEnrollment.currentWeekDayLabel}</span>
        </div>
      )}

      {enrollmentState === "other" && anyActiveEnrollment && (
        <div className={styles.enrollmentWarning} role="status">
          <div className={styles.enrollmentWarningText}>
            <span className={styles.enrollmentWarningTitle}>
              進行中のプログラムがあります
            </span>
            {anyActiveEnrollment.title}
            {anyActiveEnrollment.currentWeekDayLabel &&
              ` — 次：${anyActiveEnrollment.currentWeekDayLabel}`}
          </div>
          <div className={styles.enrollmentWarningActions}>
            <Link className={styles.enrollmentContinueCta} href={anyActiveEnrollment.continueUrl}>
              今のプログラムを続ける
            </Link>
            <ProgramSwitchButton
              href={trainHref}
              currentProgramTitle={anyActiveEnrollment.title}
              className={styles.enrollmentSwitchCta}
            />
          </div>
        </div>
      )}

      <div className={styles.actions}>
        {enrollmentState === "this" ? (
          <Link className={styles.primaryAction} href={trainHref}>
            {anyActiveEnrollment?.currentWeekDayLabel
              ? `${anyActiveEnrollment.currentWeekDayLabel}へ進む`
              : "トレーニングを再開"}
          </Link>
        ) : enrollmentState === "other" ? (
          <Link className={styles.secondaryAction} href="/programs">
            プログラム一覧へ戻る
          </Link>
        ) : (
          <>
            <Link className={styles.primaryAction} href={trainHref}>
              プログラムを開始
            </Link>
            <Link className={styles.secondaryAction} href="/programs">
              プログラム一覧へ戻る
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

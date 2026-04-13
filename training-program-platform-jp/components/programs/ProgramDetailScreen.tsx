import Link from "next/link";

import type {
  ProgramDetailState,
  ProgramDetailView,
  ProgramTag,
  ProgramTagAxis,
  WeekPreview
} from "@/types/programs";

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
      <span className={styles.sectionLabel}>Program Structure</span>
      <div className={styles.weekList}>
        {weekPreviews.map((week) => (
          <div key={week.weekNumber} className={styles.weekBlock}>
            <p className={styles.weekHeading}>
              Week {week.weekNumber}
              {week.label ? ` — ${week.label}` : ""}
            </p>
            <ol className={styles.dayList}>
              {week.days.map((day) => (
                <li key={day.dayNumber} className={styles.dayRow}>
                  <span className={styles.dayLabel}>Day {day.dayNumber}</span>
                  <span className={styles.exerciseNames}>
                    {day.exercises.map((ex) => ex.nameEn).join(" · ")}
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

type ProgramDetailScreenProps = {
  state: ProgramDetailState;
  view: ProgramDetailView;
  errorMessage?: string | null;
};

function formatSourceLabel(source: ProgramDetailView["source"]) {
  return source === "supabase" ? "Supabase" : "mock catalog";
}

function resolveTitle(state: ProgramDetailState, programTitle: string | null) {
  if (state === "loading") return "Loading program";
  if (state === "not_found") return "Program not found";
  if (state === "error") return "Program unavailable";
  return programTitle ?? "Program detail";
}

function resolveBody(
  state: ProgramDetailState,
  errorMessage: string | null | undefined
) {
  if (errorMessage) return errorMessage;
  if (state === "loading") return "Preparing the selected program detail...";
  if (state === "not_found") {
    return "This program slug is not in the current catalog.";
  }
  if (state === "error") {
    return "Please try again after refreshing the page.";
  }
  return "Review the program outline, then move into Train when you're ready.";
}

export function ProgramDetailScreen({
  state,
  view,
  errorMessage = null
}: ProgramDetailScreenProps) {
  const program = view.program;
  const isReady = state === "ready" && program !== null;
  const bodyText = resolveBody(state, errorMessage);

  function buildTrainHref() {
    if (!isReady) return "/train";
    const params = new URLSearchParams({ program: program.slug });
    // startProgramDayId: enrollment current day (if active) or first day
    if (view.startProgramDayId) {
      params.set("programDayId", view.startProgramDayId);
    }
    return `/train?${params.toString()}`;
  }

  const trainHref = buildTrainHref();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.backLink} href="/programs">
          <span aria-hidden="true">&larr;</span>
          <span>Back to Programs</span>
        </Link>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>Program Detail</span>
        <h1 className={styles.title}>{resolveTitle(state, program?.title ?? null)}</h1>
        <p className={styles.lead}>{bodyText}</p>
        <div className={styles.heroMeta}>
          <span>Source: {formatSourceLabel(view.source)}</span>
          <Link className={styles.trainLink} href={trainHref}>
            Go to Train
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
              <span className={styles.metaLabel}>Level</span>
              <strong className={styles.metaValue}>
                {program.level ?? "Level TBD"}
              </strong>
            </article>
            <article className={styles.metaCard}>
              <span className={styles.metaLabel}>Frequency</span>
              <strong className={styles.metaValue}>
                {program.frequencyLabel ?? "Frequency TBD"}
              </strong>
            </article>
            <article className={styles.metaCard}>
              <span className={styles.metaLabel}>Duration</span>
              <strong className={styles.metaValue}>
                {program.durationLabel ?? "Duration TBD"}
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
                    {tag.label}
                  </span>
                ))}
                {focusTag ? (
                  <span className={styles.focusBadge}>{focusTag.label}</span>
                ) : null}
              </div>
            );
          })()}

          <section className={styles.contentCard}>
            <span className={styles.sectionLabel}>Goal</span>
            <p className={styles.bodyCopy}>{program.goal ?? "Goal TBD"}</p>
          </section>

          <section className={styles.contentCard}>
            <span className={styles.sectionLabel}>Overview</span>
            <p className={styles.bodyCopy}>{program.overview}</p>
          </section>

          <WeekPreviewSection weekPreviews={view.weekPreviews} />
        </>
      )}

      <div className={styles.actions}>
        <Link className={styles.primaryAction} href={trainHref}>
          Go to Train
        </Link>
        <Link className={styles.secondaryAction} href="/programs">
          Back to Programs
        </Link>
      </div>
    </main>
  );
}

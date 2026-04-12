import Link from "next/link";

import type { ProgramDetailState, ProgramDetailView } from "@/types/programs";

import styles from "./ProgramDetailScreen.module.css";

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

          <section className={styles.contentCard}>
            <span className={styles.sectionLabel}>Goal</span>
            <p className={styles.bodyCopy}>{program.goal ?? "Goal TBD"}</p>
          </section>

          <section className={styles.contentCard}>
            <span className={styles.sectionLabel}>Overview</span>
            <p className={styles.bodyCopy}>{program.overview}</p>
          </section>
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

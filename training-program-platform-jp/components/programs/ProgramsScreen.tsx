import Link from "next/link";

import type { ProgramListState, ProgramListView } from "@/types/programs";

import styles from "./ProgramsScreen.module.css";

type ProgramsScreenProps = {
  state: ProgramListState;
  view: ProgramListView;
  errorMessage?: string | null;
};

function resolveTitle(state: ProgramListState) {
  if (state === "loading") return "Loading programs";
  if (state === "error") return "Programs unavailable";
  return "Programs";
}

function resolveBody(state: ProgramListState, errorMessage: string | null | undefined) {
  if (errorMessage) return errorMessage;
  if (state === "loading") return "Preparing the current program catalog...";
  if (state === "empty") return "Programs will appear here once the catalog is ready.";
  if (state === "error") return "Please try again after refreshing the page.";
  return "Choose a program base for Train, Summary, and upcoming detail pages.";
}

export function ProgramsScreen({
  state,
  view,
  errorMessage = null
}: ProgramsScreenProps) {
  const isReady = state === "ready";
  const bodyText = resolveBody(state, errorMessage);

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>Program Library</span>
        <h1 className={styles.title}>{resolveTitle(state)}</h1>
        <p className={styles.lead}>{bodyText}</p>
        <div className={styles.heroMeta}>
          <span>Source: mock catalog</span>
          <Link className={styles.trainLink} href="/train">
            Go to Train
          </Link>
        </div>
      </header>

      {!isReady ? (
        <section className={styles.statusCard}>
          <p>{bodyText}</p>
        </section>
      ) : view.items.length === 0 ? (
        <section className={styles.statusCard}>
          <p>No programs are available yet.</p>
        </section>
      ) : (
        <section className={styles.grid}>
          {view.items.map((program) => (
            <article className={styles.card} key={program.id}>
              <div className={styles.cardTop}>
                <div>
                  <h2 className={styles.cardTitle}>{program.title}</h2>
                  <p className={styles.cardSub}>
                    {program.level ?? "Level TBD"}
                  </p>
                </div>
                <span className={styles.detailHint}>Detail soon</span>
              </div>

              <p className={styles.goalText}>{program.goal ?? "Goal TBD"}</p>

              <div className={styles.metaRow}>
                <span className={styles.metaPill}>
                  {program.frequencyLabel ?? "Frequency TBD"}
                </span>
                <span className={styles.metaPillSecondary}>
                  {program.durationLabel ?? "Duration TBD"}
                </span>
              </div>

              <div className={styles.cardFooter}>
                <span className={styles.futureLink}>Program detail route coming soon</span>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

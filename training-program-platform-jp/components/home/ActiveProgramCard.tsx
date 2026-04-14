import Link from "next/link";

import type { ActiveProgramView } from "@/types/workout";

import styles from "./ActiveProgramCard.module.css";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ActiveProgramCardProps = {
  /** All active enrollments, ordered by most-recently-updated first. */
  views: ActiveProgramView[];
  isAuthenticated: boolean;
  errorMessage: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function levelLabel(level: string | null): string | null {
  if (!level) return null;
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function statusLabel(status: string): string {
  if (status === "completed") return "Done";
  if (status === "in_progress") return "Active";
  return "Cancelled";
}

function statusClass(status: string): string {
  if (status === "completed") return `${styles.sessionStatus} ${styles.statusDone}`;
  if (status === "in_progress") return `${styles.sessionStatus} ${styles.statusActive}`;
  return `${styles.sessionStatus} ${styles.statusCancelled}`;
}

// ---------------------------------------------------------------------------
// Empty / error states
// ---------------------------------------------------------------------------

function NotSignedIn() {
  return (
    <div className={styles.emptyCard}>
      <p className={styles.emptyTitle}>Sign in to track your progress</p>
      <p className={styles.emptyBody}>
        Your active program and session history will appear here.
      </p>
      <Link className={styles.emptyAction} href="/login">
        Sign In
      </Link>
    </div>
  );
}

function NoProgramCard() {
  return (
    <div className={styles.emptyCard}>
      <p className={styles.emptyTitle}>No active program</p>
      <p className={styles.emptyBody}>
        Choose a program from the library to get started. Your progress will be
        tracked here.
      </p>
      <Link className={styles.emptyAction} href="/programs">
        Browse Programs
      </Link>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className={`${styles.emptyCard} ${styles.errorCard}`}>
      <p className={styles.emptyBody}>{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single program card body
// Extracted so it can be rendered for each enrollment independently.
// ---------------------------------------------------------------------------

function ProgramCard({ view }: { view: ActiveProgramView }) {
  return (
    <div className={styles.card}>
      {/* ---- header ---- */}
      <div className={styles.cardHeader}>
        <span className={styles.sectionLabel}>My Program</span>
        {view.level && (
          <span className={styles.levelBadge}>{levelLabel(view.level)}</span>
        )}
      </div>

      {/* ---- program identity ---- */}
      <h2 className={styles.programTitle}>{view.programTitle}</h2>

      <div className={styles.meta}>
        <span className={styles.metaItem}>{view.frequencyLabel}</span>
        <span className={styles.metaDot} aria-hidden="true">·</span>
        <span className={styles.metaItem}>{view.durationLabel}</span>
      </div>

      {/* ---- progress bar (hidden when totalDays = 0) ---- */}
      {view.totalDays > 0 && (
        <div className={styles.progressSection}>
          <div className={styles.progressHeader}>
            <span className={styles.progressText}>
              {view.completedDays} / {view.totalDays} days complete
            </span>
            <span className={styles.progressPct}>{view.progressPercent}%</span>
          </div>
          <div
            className={styles.progressBar}
            role="progressbar"
            aria-valuenow={view.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${view.progressPercent}% complete`}
          >
            <div
              className={styles.progressFill}
              style={{ width: `${view.progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* ---- current position ---- */}
      {view.currentWeekDayLabel && (
        <div className={styles.positionRow}>
          <span className={styles.positionLabel}>Up next</span>
          <span className={styles.positionValue}>{view.currentWeekDayLabel}</span>
        </div>
      )}

      {/* ---- primary CTA ---- */}
      <Link className={styles.continueButton} href={view.continueUrl}>
        Continue Training
      </Link>

      {/* ---- recent sessions ---- */}
      {view.recentSessions.length > 0 && (
        <div className={styles.recentsSection}>
          <span className={styles.recentsLabel}>Recent sessions</span>
          <ul className={styles.recentsList}>
            {view.recentSessions.map((session) => (
              <li key={session.sessionId} className={styles.recentItem}>
                <Link
                  className={styles.recentLink}
                  href={`/session-history/${session.sessionId}`}
                >
                  <span className={styles.recentDate}>{session.startedAt}</span>
                  {session.programWeekDayLabel && (
                    <span className={styles.recentDay}>
                      {session.programWeekDayLabel}
                    </span>
                  )}
                  <span className={statusClass(session.status)}>
                    {statusLabel(session.status)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link className={styles.historyLink} href="/session-history">
            View all sessions →
          </Link>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

/**
 * H-3c: Renders 0 / 1 / N enrollment cards.
 *
 * - 0 enrollments → empty state (same as before)
 * - 1 enrollment  → single ProgramCard (identical appearance to pre-H-3c)
 * - 2+ enrollments → multiple ProgramCards stacked vertically
 */
export function ActiveProgramCard({
  views,
  isAuthenticated,
  errorMessage
}: ActiveProgramCardProps) {
  if (errorMessage) return <ErrorCard message={errorMessage} />;
  if (!isAuthenticated) return <NotSignedIn />;
  if (views.length === 0) return <NoProgramCard />;

  return (
    <>
      {views.map((view) => (
        <ProgramCard key={view.enrollmentId} view={view} />
      ))}
    </>
  );
}

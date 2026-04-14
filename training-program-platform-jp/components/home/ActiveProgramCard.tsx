import Link from "next/link";

import type { ActiveProgramView, E1RMTrend, VolumeTrend } from "@/types/workout";

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
// H-4: Volume trend section
// ---------------------------------------------------------------------------

/**
 * Renders the volume trend for one enrollment.
 * - 0 completed sessions → returns null (section hidden)
 * - 1 session → shows latest volume + "Not enough data"
 * - 2+ sessions → shows sparkline + previous → latest + change %
 */
function TrendSection({ trend }: { trend: VolumeTrend }) {
  if (trend.recentVolumes.length === 0) return null;

  const maxVolume = Math.max(...trend.recentVolumes, 1);
  const hasComparison =
    trend.latestVolume !== null &&
    trend.previousVolume !== null &&
    trend.volumeChangePercent !== null;

  return (
    <div className={styles.trendSection}>
      <div className={styles.trendHeader}>
        <span className={styles.trendLabel}>Volume trend</span>
        <span className={styles.trendMeta}>
          Last {trend.recentVolumes.length} session
          {trend.recentVolumes.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Mini sparkline — bars normalized to max volume */}
      <div className={styles.sparkline} aria-hidden="true">
        {trend.recentVolumes.map((v, i) => {
          const isLatest = i === trend.recentVolumes.length - 1;
          return (
            <div
              key={i}
              className={`${styles.sparkBar} ${isLatest ? styles.sparkBarLatest : ""}`}
              style={{ height: `${Math.max(Math.round((v / maxVolume) * 100), 4)}%` }}
            />
          );
        })}
      </div>

      {/* Volume comparison */}
      <div className={styles.trendValues}>
        {hasComparison ? (
          <>
            <span className={styles.trendVolume}>
              {trend.previousVolume!.toLocaleString()} → {trend.latestVolume!.toLocaleString()}
            </span>
            <span
              className={`${styles.trendChange} ${
                trend.volumeChangePercent! >= 0 ? styles.trendUp : styles.trendDown
              }`}
            >
              {trend.volumeChangePercent! >= 0 ? "+" : ""}
              {trend.volumeChangePercent}%
            </span>
          </>
        ) : (
          <>
            <span className={styles.trendVolume}>
              {trend.latestVolume!.toLocaleString()} kg
            </span>
            <span className={styles.trendInsufficient}>Not enough data</span>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// H-4b: Estimated 1RM trend section (T1 primary lift)
// ---------------------------------------------------------------------------

/**
 * Renders the e1RM trend for the enrollment's primary T1 lift.
 * - 0 sessions with T1 data → returns null (section hidden)
 * - 1 session → shows latest e1RM + "Not enough data"
 * - 2+ sessions → shows sparkline + previous → latest + change %
 */
function E1RMSection({ e1rmTrend }: { e1rmTrend: E1RMTrend }) {
  if (e1rmTrend.recentE1RMs.length === 0) return null;

  const maxE1RM = Math.max(...e1rmTrend.recentE1RMs, 1);
  const hasComparison =
    e1rmTrend.latestE1RM !== null &&
    e1rmTrend.previousE1RM !== null &&
    e1rmTrend.e1rmChangePercent !== null;

  return (
    <div className={styles.trendSection}>
      <div className={styles.trendHeader}>
        <span className={styles.trendLabel}>Est. 1RM · T1</span>
        <span className={styles.trendMeta}>
          Last {e1rmTrend.recentE1RMs.length} session
          {e1rmTrend.recentE1RMs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Mini sparkline — bars normalized to max e1RM */}
      <div className={styles.sparkline} aria-hidden="true">
        {e1rmTrend.recentE1RMs.map((v, i) => {
          const isLatest = i === e1rmTrend.recentE1RMs.length - 1;
          return (
            <div
              key={i}
              className={`${styles.sparkBar} ${isLatest ? styles.sparkBarLatest : ""}`}
              style={{ height: `${Math.max(Math.round((v / maxE1RM) * 100), 4)}%` }}
            />
          );
        })}
      </div>

      {/* E1RM comparison */}
      <div className={styles.trendValues}>
        {hasComparison ? (
          <>
            <span className={styles.trendVolume}>
              {e1rmTrend.previousE1RM!.toFixed(1)} → {e1rmTrend.latestE1RM!.toFixed(1)} kg
            </span>
            <span
              className={`${styles.trendChange} ${
                e1rmTrend.e1rmChangePercent! >= 0 ? styles.trendUp : styles.trendDown
              }`}
            >
              {e1rmTrend.e1rmChangePercent! >= 0 ? "+" : ""}
              {e1rmTrend.e1rmChangePercent}%
            </span>
          </>
        ) : (
          <>
            <span className={styles.trendVolume}>
              {e1rmTrend.latestE1RM!.toFixed(1)} kg
            </span>
            <span className={styles.trendInsufficient}>Not enough data</span>
          </>
        )}
      </div>
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

      {/* ---- S-2: primary CTA (Resume / Start / fallback) ---- */}
      <Link className={styles.continueButton} href={view.continueUrl}>
        {view.actionType === "resume"
          ? "Resume workout"
          : view.actionType === "start"
          ? "Start next workout"
          : "Continue Training"}
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

      {/* ---- H-4: volume trend ---- */}
      <TrendSection trend={view.trend} />

      {/* ---- H-4b: e1RM trend (primary T1 lift) ---- */}
      <E1RMSection e1rmTrend={view.e1rmTrend} />
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

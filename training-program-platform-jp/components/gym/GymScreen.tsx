import Link from "next/link";

import type { GymAnnouncement } from "@/lib/gym/announcements";
import type { GymSponsor } from "@/lib/gym/sponsors";
import type { MembershipStatus } from "@/lib/workout/membership";
import type { GymDashboardStats } from "@/lib/workout/gym-dashboard";
import { GymAnnouncementSection } from "./GymAnnouncementSection";
import { GymConsultationForm } from "./GymConsultationForm";
import { GymTrainingGapBanner } from "./GymTrainingGapBanner";

import styles from "./GymScreen.module.css";

// ---------------------------------------------------------------------------
// Training gap helpers
// ---------------------------------------------------------------------------

/** Returns the number of whole days since lastTrainingDate (JST "YYYY-MM-DD"). */
function getDaysSince(lastTrainingDate: string | null): number | null {
  if (!lastTrainingDate) return null;
  const last = new Date(`${lastTrainingDate}T00:00:00+09:00`);
  const todayJst = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
  );
  todayJst.setHours(0, 0, 0, 0);
  const diffMs = todayJst.getTime() - last.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

type TrainingGapInfo = {
  daysLabel: string;
  message: string;
  level: "none" | "good" | "ok" | "warn" | "alert";
};

function getTrainingGapInfo(days: number | null): TrainingGapInfo {
  if (days === null) {
    return {
      daysLabel: "",
      message: "まだトレーニング記録がありません。まずは最初の1回から始めてみましょう。",
      level: "none"
    };
  }
  if (days === 0) {
    return {
      daysLabel: "今日トレーニングしました",
      message: "今日もトレーニングできています。いいペースです。",
      level: "good"
    };
  }
  if (days <= 2) {
    return {
      daysLabel: `前回から${days}日経過`,
      message: "いいペースです。今日も無理なく続けていきましょう。",
      level: "good"
    };
  }
  if (days <= 6) {
    return {
      daysLabel: `前回から${days}日経過`,
      message: "少し間が空いています。今日は軽めでもOKです。",
      level: "ok"
    };
  }
  if (days <= 13) {
    return {
      daysLabel: `前回から${days}日経過`,
      message: "前回から1週間ほど空いています。まずは短時間で再開しましょう。",
      level: "warn"
    };
  }
  return {
    daysLabel: `前回から${days}日経過`,
    message: "しばらく間が空いています。重量は控えめにして、フォーム確認から始めましょう。",
    level: "alert"
  };
}

// ── Quick links ───────────────────────────────────────────────────────────────

const QUICK_LINKS = [
  { href: "/train", label: "トレーニング開始", icon: "🏋️" },
  { href: "/programs", label: "プログラム一覧", icon: "📋" },
  { href: "/session-history", label: "トレーニング履歴", icon: "📅" },
  { href: "/profile", label: "プロフィール", icon: "👤" }
] as const;

function getMembershipNotice(status: MembershipStatus | null | undefined): string | null {
  switch (status) {
    case "paused":
      return "現在、休会中のため一部機能はご利用いただけません。再開をご希望の場合はスタッフまでご連絡ください。";
    case "cancelled":
      return "現在、このアカウントでは一部機能をご利用いただけません。再度利用をご希望の場合はスタッフまでお問い合わせください。";
    default:
      return null;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

type GymScreenProps = {
  stats: GymDashboardStats | null;
  announcements: GymAnnouncement[];
  sponsors: GymSponsor[];
  membershipStatus?: MembershipStatus | null;
};

export function GymScreen({ stats, announcements, sponsors, membershipStatus }: GymScreenProps) {
  const isLoggedIn = stats !== null;
  const membershipNotice = getMembershipNotice(membershipStatus);
  const trainingGap = isLoggedIn
    ? getTrainingGapInfo(getDaysSince(stats.lastTrainingDate))
    : null;

  return (
    <main className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>ジム</h1>
        <p className={styles.gymName}>Hirayama Gym</p>
      </div>

      {/* Soft notice for non-active members */}
      {membershipNotice && (
        <aside className={styles.membershipNotice}>
          <p className={styles.membershipNoticeText}>{membershipNotice}</p>
        </aside>
      )}

      {/* Monthly training stats */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>今月のトレーニング</h2>
        <div className={styles.statsCard}>
          {isLoggedIn ? (
            <>
              <div className={styles.statsRow}>
                <span className={styles.statsCount}>{stats.monthlyCount}</span>
                <span className={styles.statsUnit}>回</span>
              </div>
              <p className={styles.statsDate}>
                {stats.lastTrainingDate
                  ? `最終トレーニング: ${stats.lastTrainingDate}`
                  : "まだトレーニング記録がありません"}
              </p>
              {trainingGap && (
                <GymTrainingGapBanner
                  trainingGap={trainingGap}
                  showCta={trainingGap.level !== "none"}
                />
              )}
              <Link className={styles.statsLink} href="/session-history">
                履歴を見る →
              </Link>
            </>
          ) : (
            <p className={styles.statsGuest}>
              <Link className={styles.loginLink} href="/login">
                ログイン
              </Link>
              すると今月の実施回数が表示されます。
            </p>
          )}
        </div>
      </section>

      {/* Quick links */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>クイックメニュー</h2>
        <div className={styles.quickGrid}>
          {QUICK_LINKS.map(({ href, label, icon }) => (
            <Link key={href} className={styles.quickItem} href={href}>
              <span className={styles.quickIcon}>{icon}</span>
              <span className={styles.quickLabel}>{label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Announcements — G-3: unread badge via localStorage */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>お知らせ</h2>
        <GymAnnouncementSection announcements={announcements} />
      </section>

      {/* Sponsors — G-4: DB-backed */}
      {sponsors.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>スポンサー・協力店</h2>
          <div className={styles.cardList}>
            {sponsors.map((sp) => (
              <div className={styles.sponsorCard} key={sp.id}>
                <div className={styles.sponsorLogo}>
                  {sp.name.slice(0, 1).toUpperCase()}
                </div>
                <div className={styles.sponsorInfo}>
                  {sp.url ? (
                    <a
                      className={styles.sponsorNameLink}
                      href={sp.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {sp.name}
                    </a>
                  ) : (
                    <p className={styles.sponsorName}>{sp.name}</p>
                  )}
                  {sp.description && (
                    <p className={styles.sponsorTagline}>{sp.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Account */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>アカウント</h2>
        <Link href="/profile" className={styles.profileLink}>
          <span>プロフィール設定</span>
          <span className={styles.profileLinkArrow}>›</span>
        </Link>
      </section>

      {/* Consultation / Personal Training — G-5 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>トレーナー相談・パーソナルトレーニング</h2>
        <GymConsultationForm />
      </section>
    </main>
  );
}

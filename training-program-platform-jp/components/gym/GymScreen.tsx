import Link from "next/link";

import type { GymAnnouncement } from "@/lib/gym/announcements";
import type { GymDashboardStats } from "@/lib/workout/gym-dashboard";
import { GymAnnouncementSection } from "./GymAnnouncementSection";

import styles from "./GymScreen.module.css";

// ── Static data (G-4 will move sponsors to DB) ───────────────────────────────

type Sponsor = {
  id: number;
  initial: string;
  name: string;
  tagline: string;
};

const SPONSORS: Sponsor[] = [
  {
    id: 1,
    initial: "H",
    name: "Hirayama Sports",
    tagline: "トレーニング用品・サプリメント"
  },
  {
    id: 2,
    initial: "協",
    name: "協力店 募集中",
    tagline: "詳細はスタッフまでお問い合わせください"
  }
];

// ── Quick links ───────────────────────────────────────────────────────────────

const QUICK_LINKS = [
  { href: "/train", label: "トレーニング開始", icon: "🏋️" },
  { href: "/programs", label: "プログラム一覧", icon: "📋" },
  { href: "/session-history", label: "トレーニング履歴", icon: "📅" },
  { href: "/profile", label: "プロフィール", icon: "👤" }
] as const;

// ── Component ────────────────────────────────────────────────────────────────

type GymScreenProps = {
  stats: GymDashboardStats | null;
  announcements: GymAnnouncement[];
};

export function GymScreen({ stats, announcements }: GymScreenProps) {
  const isLoggedIn = stats !== null;

  return (
    <main className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>ジム</h1>
        <p className={styles.gymName}>Hirayama Gym</p>
      </div>

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

      {/* Sponsors */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>スポンサー・協力店</h2>
        <div className={styles.cardList}>
          {SPONSORS.map((sp) => (
            <div className={styles.sponsorCard} key={sp.id}>
              <div className={styles.sponsorLogo}>{sp.initial}</div>
              <div className={styles.sponsorInfo}>
                <p className={styles.sponsorName}>{sp.name}</p>
                <p className={styles.sponsorTagline}>{sp.tagline}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Account */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>アカウント</h2>
        <Link href="/profile" className={styles.profileLink}>
          <span>プロフィール設定</span>
          <span className={styles.profileLinkArrow}>›</span>
        </Link>
      </section>

      {/* Communication placeholder (G-5 slot) */}
      <div className={styles.comingSoonCard}>
        <p className={styles.comingSoonText}>
          トレーナーへの相談・パーソナルトレーニング申込は近日対応予定です。
        </p>
      </div>
    </main>
  );
}

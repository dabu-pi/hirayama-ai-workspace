import Link from "next/link";

import type { GymDashboardStats } from "@/lib/workout/gym-dashboard";

import styles from "./GymScreen.module.css";

// ── Static data (G-2/G-4 will move these to DB) ──────────────────────────────

type Announcement = {
  id: number;
  title: string;
  date: string;
  body: string;
};

type Sponsor = {
  id: number;
  initial: string;
  name: string;
  tagline: string;
};

const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 1,
    title: "ゴールデンウィーク営業のご案内",
    date: "2026-04-28",
    body: "4月29日（火）〜5月6日（火）は通常営業です。お気軽にご来館ください。"
  },
  {
    id: 2,
    title: "新マシン導入のお知らせ",
    date: "2026-04-20",
    body: "レッグプレスマシンを新たに導入しました。ぜひご利用ください。"
  },
  {
    id: 3,
    title: "フォーム確認会のお知らせ",
    date: "2026-04-15",
    body: "5月3日（土）10:00〜12:00にスクワット・デッドリフトのフォーム確認会を行います。"
  }
];

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
};

export function GymScreen({ stats }: GymScreenProps) {
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

      {/* Announcements */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>お知らせ</h2>
        <div className={styles.cardList}>
          {ANNOUNCEMENTS.map((item) => (
            <div className={styles.card} key={item.id}>
              <p className={styles.cardTitle}>{item.title}</p>
              <p className={styles.cardDate}>{item.date}</p>
              <p className={styles.cardBody}>{item.body}</p>
            </div>
          ))}
        </div>
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

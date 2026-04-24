import Link from "next/link";

import styles from "./GymScreen.module.css";

export function GymScreen() {
  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Gym</h1>
        <p className={styles.gymName}>Hirayama Gym</p>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>お知らせ</h2>
        <div className={styles.card}>
          <p className={styles.cardTitle}>ゴールデンウィーク営業のご案内</p>
          <p className={styles.cardDate}>2026-04-28</p>
          <p className={styles.cardBody}>
            4月29日（火）〜5月6日（火）は通常営業です。
            お気軽にご来館ください。
          </p>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>スポンサー</h2>
        <div className={styles.sponsorCard}>
          <div className={styles.sponsorLogo}>H</div>
          <div className={styles.sponsorInfo}>
            <p className={styles.sponsorName}>Hirayama Sports</p>
            <p className={styles.sponsorTagline}>トレーニング用品・サプリメント</p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>アカウント</h2>
        <Link href="/profile" className={styles.profileLink}>
          <span>プロフィール設定</span>
          <span className={styles.profileLinkArrow}>›</span>
        </Link>
      </section>

      <p className={styles.stubNotice}>
        このページは準備中です。<br />
        ジム情報・会員機能は今後追加予定です。
      </p>
    </main>
  );
}

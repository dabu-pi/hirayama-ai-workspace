import Link from "next/link";

import styles from "./TrainAuthRequired.module.css";

/**
 * Phase 2: Shown when a logged-in user's membership_status is not 'active'.
 * Reuses TrainAuthRequired styles — same visual weight, no new CSS needed.
 */
export function MembershipRequiredScreen() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Membership Required</span>
        <h1 className={styles.title}>ご利用いただけません</h1>
        <p className={styles.body}>
          現在、このアカウントではトレーニング機能をご利用いただけない状態です。
          ご不明な点はお問い合わせください。
        </p>
      </section>

      <div className={styles.actions}>
        <Link className={styles.programsLink} href="/programs">
          プログラム一覧へ
        </Link>
      </div>
    </main>
  );
}

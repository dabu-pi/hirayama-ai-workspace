import Link from "next/link";

import styles from "./TrainAuthRequired.module.css";

/**
 * Shown when an unauthenticated user reaches /train.
 * Provides a direct path to /login and a fallback to /programs.
 */
export function TrainAuthRequired() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>ログインが必要です</span>
        <h1 className={styles.title}>ログインが必要です</h1>
        <p className={styles.body}>
          ワークアウトを記録・再開するにはログインしてください。
          プログラムの閲覧はログインなしでも可能です。
        </p>
      </section>

      <div className={styles.actions}>
        <Link className={styles.loginButton} href="/login">
          ログインへ
        </Link>
        <Link className={styles.programsLink} href="/programs">
          プログラム一覧へ戻る
        </Link>
      </div>
    </main>
  );
}

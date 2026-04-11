import Link from "next/link";

import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Implementation Skeleton</span>
        <h1 className={styles.title}>Training Program Platform JP</h1>
        <p className={styles.lead}>
          Next.js App Router（Next.js の画面構成）と Supabase
          を前提に、本実装へ入るための骨組みを配置した。
          まずは「今日のワークアウト」と「種目単体履歴」をダミーデータで確認できる。
        </p>

        <div className={styles.actions}>
          <Link className={styles.primaryButton} href="/train">
            /train を開く
          </Link>
          <a className={styles.secondaryButton} href="/api/workout-sessions">
            API 雛形を見る
          </a>
        </div>
      </section>

      <section className={styles.section}>
        <article className={styles.card}>
          <h2 className={styles.cardTitle}>今回できたこと</h2>
          <ul className={styles.list}>
            <li>App Router ベースのページ構成</li>
            <li>Train 画面と Exercise History 画面の土台</li>
            <li>Route Handlers（同一アプリ内API）の最小雛形</li>
            <li>Supabase client / server ヘルパー</li>
            <li>schema（DB表定義）migration 雛形</li>
          </ul>
        </article>
      </section>
    </main>
  );
}

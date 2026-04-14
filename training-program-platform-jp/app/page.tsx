import Link from "next/link";

import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Implementation Skeleton</span>
        <h1 className={styles.title}>Training Program Platform JP</h1>
        <p className={styles.lead}>
          Next.js App Router and Supabase are wired together as the foundation for a
          mobile-first training workflow. Start from Programs to choose a base, move
          into Train to log the session, and land on Summary after finishing.
        </p>

        <div className={styles.actions}>
          <Link className={styles.primaryButton} href="/programs">
            Open Programs
          </Link>
          <Link className={styles.secondaryButton} href="/train">
            Open Train
          </Link>
          <Link className={styles.secondaryButton} href="/session-history">
            Session History
          </Link>
        </div>
      </section>

      <section className={styles.section}>
        <article className={styles.card}>
          <h2 className={styles.cardTitle}>Current MVP</h2>
          <ul className={styles.list}>
            <li>Programs library route for the current catalog foundation</li>
            <li>Train screen for session logging and exercise operations</li>
            <li>Workout summary route after Finish completes</li>
            <li>Exercise history route backed by Supabase reads</li>
            <li>Server-side helpers aligned with future route expansion</li>
          </ul>
        </article>
      </section>
    </main>
  );
}

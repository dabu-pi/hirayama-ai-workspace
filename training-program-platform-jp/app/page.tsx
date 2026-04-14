export const dynamic = "force-dynamic";

import Link from "next/link";

import { ActiveProgramCard } from "@/components/home/ActiveProgramCard";
import { getActiveProgramView } from "@/lib/workout/active-program";

import styles from "./page.module.css";

export default async function HomePage() {
  const { views, isAuthenticated, errorMessage } = await getActiveProgramView();

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Training Platform</span>
        <h1 className={styles.title}>Training Program Platform JP</h1>
        <p className={styles.lead}>
          Choose a program, log each session, and track your progress toward
          completing the full training cycle.
        </p>
      </section>

      <section className={styles.section}>
        <ActiveProgramCard
          views={views}
          isAuthenticated={isAuthenticated}
          errorMessage={errorMessage}
        />
      </section>

      <section className={styles.section}>
        <nav className={styles.navGrid}>
          <Link className={styles.navCard} href="/programs">
            <span className={styles.navIcon} aria-hidden="true">📋</span>
            <span className={styles.navLabel}>Programs</span>
            <span className={styles.navSub}>Browse the full library</span>
          </Link>
          <Link className={styles.navCard} href="/train">
            <span className={styles.navIcon} aria-hidden="true">🏋️</span>
            <span className={styles.navLabel}>Train</span>
            <span className={styles.navSub}>Log today&apos;s session</span>
          </Link>
          <Link className={styles.navCard} href="/session-history">
            <span className={styles.navIcon} aria-hidden="true">📈</span>
            <span className={styles.navLabel}>History</span>
            <span className={styles.navSub}>Recent sessions</span>
          </Link>
        </nav>
      </section>
    </main>
  );
}

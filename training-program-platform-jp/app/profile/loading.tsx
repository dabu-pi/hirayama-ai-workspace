import styles from "@/app/train/loading.module.css";

export default function ProfileLoading() {
  return (
    <main className={styles.page}>
      <div className={styles.dots} aria-hidden="true">
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
      <p>読み込み中...</p>
    </main>
  );
}

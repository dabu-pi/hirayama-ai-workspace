import Link from "next/link";

import type { ProgramStatRow } from "@/lib/admin/program-stats";
import styles from "./ProgramStatsScreen.module.css";

type Props = {
  stats: ProgramStatRow[];
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

const LEVEL_LABEL: Record<string, string> = {
  beginner: "初級",
  intermediate: "中級",
  advanced: "上級"
};

export function ProgramStatsScreen({ stats }: Props) {
  const totalEnrollments = stats.reduce((sum, r) => sum + r.totalEnrollments, 0);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/admin" className={styles.back}>← 管理メニュー</Link>
        <h1 className={styles.title}>プログラム利用状況</h1>
        <p className={styles.subtitle}>
          個人を特定できる情報は表示していません。プログラム別の選択数・進行状況のみ表示します。
        </p>
      </header>

      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{totalEnrollments}</span>
          <span className={styles.summaryLabel}>累計選択数（全プログラム）</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{stats.reduce((s, r) => s + r.activeCount, 0)}</span>
          <span className={styles.summaryLabel}>現在利用中</span>
        </div>
      </div>

      {stats.length === 0 ? (
        <p className={styles.empty}>プログラムが登録されていません。</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thRank}>順位</th>
                <th className={styles.thName}>プログラム名</th>
                <th className={styles.thNum}>累計</th>
                <th className={styles.thNum}>利用中</th>
                <th className={styles.thNum}>完了</th>
                <th className={styles.thNum}>休止</th>
                <th className={styles.thDate}>最終選択日</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row, idx) => (
                <tr key={row.programId} className={idx === 0 ? styles.topRow : ""}>
                  <td className={styles.tdRank}>
                    {idx + 1}
                    {idx === 0 && row.totalEnrollments > 0 && (
                      <span className={styles.topBadge}>★</span>
                    )}
                  </td>
                  <td className={styles.tdName}>
                    <span className={styles.programTitle}>{row.title}</span>
                    {row.level && (
                      <span className={styles.levelChip}>
                        {LEVEL_LABEL[row.level] ?? row.level}
                      </span>
                    )}
                  </td>
                  <td className={styles.tdNum}>{row.totalEnrollments}</td>
                  <td className={`${styles.tdNum} ${row.activeCount > 0 ? styles.activeNum : ""}`}>
                    {row.activeCount}
                  </td>
                  <td className={styles.tdNum}>{row.completedCount}</td>
                  <td className={styles.tdNum}>{row.pausedCount}</td>
                  <td className={styles.tdDate}>{formatDate(row.lastEnrolledAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className={styles.note}>
        ※ 「利用中」は現在アクティブな受講数。同一ユーザーが同じプログラムを複数回受講した場合も累計に含まれます。
      </p>
    </main>
  );
}

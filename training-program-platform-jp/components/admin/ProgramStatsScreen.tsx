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

/**
 * Rule-based admin comment — no AI API.
 * Helps operations staff quickly read the health of each program.
 */
function getAdminComment(row: ProgramStatRow): { text: string; variant: "good" | "info" | "caution" | "" } {
  const { totalEnrollments, activeCount, completedCount, pausedCount } = row;

  if (totalEnrollments === 0) {
    return { text: "未選択", variant: "info" };
  }

  const completionRate = completedCount / totalEnrollments;
  const switchRate = pausedCount / totalEnrollments;

  if (completionRate >= 0.5) {
    return { text: `完走率${Math.round(completionRate * 100)}% — 継続しやすいプログラム`, variant: "good" };
  }
  if (completionRate >= 0.3) {
    return { text: `完走率${Math.round(completionRate * 100)}% — 完走者あり`, variant: "good" };
  }
  if (switchRate >= 0.5) {
    return { text: "切替が多い — 他プログラムへの移行が目立つ", variant: "caution" };
  }
  if (activeCount > 0 && completedCount === 0) {
    return { text: "利用中のみ — 完走者はまだなし", variant: "info" };
  }
  return { text: "", variant: "" };
}

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
                <th className={styles.thNum}>累計選択数</th>
                <th className={styles.thNum}>利用中</th>
                <th className={styles.thNum}>完了</th>
                <th className={styles.thNum}>切替中断</th>
                <th className={styles.thDate}>最終選択日</th>
                <th className={styles.thComment}>運営コメント</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row, idx) => {
                const comment = getAdminComment(row);
                return (
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
                    <td className={styles.tdComment}>
                      {comment.text && (
                        <span className={
                          comment.variant === "good" ? styles.commentGood
                          : comment.variant === "caution" ? styles.commentCaution
                          : styles.commentInfo
                        }>
                          {comment.text}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <section className={styles.legend}>
        <h2 className={styles.legendTitle}>ステータスの意味</h2>
        <dl className={styles.legendList}>
          <dt>利用中 (active)</dt>
          <dd>現在プログラムを進めているユーザー数（アーカイブ済みは除く）</dd>
          <dt>完了 (completed)</dt>
          <dd>プログラムの全日程を完走したユーザー数（のべ件数）</dd>
          <dt>切替中断 (paused)</dt>
          <dd>このプログラム進行中に別のプログラムを開始し、自動的に中断された件数。会員の「休会」とは無関係</dd>
        </dl>
      </section>
    </main>
  );
}

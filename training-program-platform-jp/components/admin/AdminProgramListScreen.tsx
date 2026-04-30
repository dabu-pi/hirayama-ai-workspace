import Link from "next/link";

import type { AdminProgramRow } from "@/lib/admin/programs";
import { formatProgramTagLabel } from "@/lib/workout/format-labels";
import styles from "./AdminProgramListScreen.module.css";

type Props = {
  programs: AdminProgramRow[];
};

const LEVEL_LABEL: Record<string, string> = {
  beginner: "初級",
  intermediate: "中級",
  advanced: "上級"
};

const METHODOLOGY_LABEL: Record<string, string> = {
  gzcl: "GZCL",
  linear: "リニア",
  generic: "汎用"
};

// goal/equipment/split タグのみ表示（focus は省略）
const DISPLAY_AXES = ["goal", "equipment", "split"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

export function AdminProgramListScreen({ programs }: Props) {
  const publicCount  = programs.filter((p) => p.isPublic).length;
  const privateCount = programs.length - publicCount;
  const totalActive  = programs.reduce((s, p) => s + p.activeEnrollments, 0);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/admin" className={styles.back}>← 管理メニュー</Link>
        <h1 className={styles.title}>プログラム管理</h1>
        <p className={styles.subtitle}>
          全プログラム（非公開含む）の一覧です。read only — 詳細・編集は次フェーズで対応予定。
        </p>
      </header>

      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{programs.length}</span>
          <span className={styles.summaryLabel}>登録数（全体）</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{publicCount}</span>
          <span className={styles.summaryLabel}>公開中</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{privateCount}</span>
          <span className={styles.summaryLabel}>非公開</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{totalActive}</span>
          <span className={styles.summaryLabel}>現在利用中（全プログラム計）</span>
        </div>
      </div>

      {programs.length === 0 ? (
        <p className={styles.empty}>プログラムがまだ登録されていません。</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thName}>プログラム名 / タグ</th>
                <th className={styles.thSlug}>slug</th>
                <th className={styles.thMeta}>構成</th>
                <th className={styles.thNum}>累計</th>
                <th className={styles.thNum}>利用中</th>
                <th className={styles.thNum}>日数</th>
                <th className={styles.thNum}>種目</th>
                <th className={styles.thDate}>作成日</th>
                <th className={styles.thAction}>操作</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((row) => {
                const displayTags = row.tags.filter((t) =>
                  DISPLAY_AXES.includes(t.axis)
                );

                return (
                  <tr key={row.id}>
                    {/* プログラム名 + badges + tags */}
                    <td className={styles.tdName}>
                      <span className={styles.programTitle}>{row.title}</span>
                      <div className={styles.badgeRow}>
                        {row.level && (
                          <span className={styles.levelChip}>
                            {LEVEL_LABEL[row.level] ?? row.level}
                          </span>
                        )}
                        <span className={row.isPublic ? styles.publicChip : styles.privateChip}>
                          {row.isPublic ? "公開" : "非公開"}
                        </span>
                      </div>
                      {displayTags.length > 0 && (
                        <div className={styles.tagRow}>
                          {displayTags.map((tag) => (
                            <span key={tag.slug} className={styles.tagChip}>
                              {formatProgramTagLabel(tag.slug, tag.label)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* slug */}
                    <td className={styles.tdSlug}>
                      <code className={styles.slugCode}>{row.slug}</code>
                    </td>

                    {/* 構成: days/week × weeks / methodology */}
                    <td className={styles.tdMeta}>
                      <span className={styles.metaLine}>
                        {row.daysPerWeek}日/週 × {row.durationWeeks}週
                      </span>
                      {row.methodology && (
                        <span className={styles.methodologyChip}>
                          {METHODOLOGY_LABEL[row.methodology] ?? row.methodology}
                        </span>
                      )}
                    </td>

                    <td className={styles.tdNum}>{row.totalEnrollments}</td>

                    <td
                      className={`${styles.tdNum} ${
                        row.activeEnrollments > 0 ? styles.activeNum : ""
                      }`}
                    >
                      {row.activeEnrollments}
                    </td>

                    <td className={styles.tdNum}>
                      {row.totalDays > 0 ? row.totalDays : "—"}
                    </td>

                    <td className={styles.tdNum}>
                      {row.totalExercises > 0 ? row.totalExercises : "—"}
                    </td>

                    <td className={styles.tdDate}>{formatDate(row.createdAt)}</td>

                    {/* 詳細リンク — A-1b 未実装のため非活性表示 */}
                    <td className={styles.tdAction}>
                      <span className={styles.nextPhaseLabel}>次フェーズ</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className={styles.note}>
        ※ 詳細表示・編集機能は A-1b 以降で実装予定です。
      </p>
    </main>
  );
}

import Link from "next/link";

import type { AdminProgramDetail } from "@/lib/admin/program-detail";
import { formatProgramTagLabel } from "@/lib/workout/format-labels";
import { WeekLabelEditor } from "./WeekLabelEditor";
import { DayInfoEditor } from "./DayInfoEditor";
import { ExerciseParamEditor } from "./ExerciseParamEditor";
import styles from "./AdminProgramDetailScreen.module.css";

type Props = {
  program: AdminProgramDetail;
};

const LEVEL_LABEL: Record<string, string> = {
  beginner: "初級",
  intermediate: "中級",
  advanced: "上級"
};

const METHODOLOGY_LABEL: Record<string, string> = {
  gzcl: "GZCL",
  linear: "リニア",
  generic: "汎用",
  custom: "カスタム"
};

const SOURCE_FIDELITY_LABEL: Record<string, string> = {
  original: "原典準拠",
  adapted: "改変版",
  custom: "独自作成"
};


function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

export function AdminProgramDetailScreen({ program }: Props) {
  const { enrollmentStats: stats, weeks } = program;
  const totalDays      = weeks.reduce((s, w) => s + w.days.length, 0);
  const totalExercises = weeks.reduce(
    (s, w) => s + w.days.reduce((ds, d) => ds + d.exercises.length, 0),
    0
  );

  return (
    <main className={styles.page}>
      {/* ── ヘッダー ── */}
      <header className={styles.header}>
        <Link href="/admin/programs" className={styles.back}>← プログラム管理</Link>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{program.title}</h1>
          <div className={styles.headerBadges}>
            {program.level && (
              <span className={styles.levelChip}>
                {LEVEL_LABEL[program.level] ?? program.level}
              </span>
            )}
            <span className={program.isPublic ? styles.publicChip : styles.privateChip}>
              {program.isPublic ? "公開" : "非公開"}
            </span>
            {program.methodology && (
              <span className={styles.methodologyChip}>
                {METHODOLOGY_LABEL[program.methodology] ?? program.methodology}
              </span>
            )}
          </div>
        </div>
        <div className={styles.headerActions}>
          <Link
            href={`/admin/programs/${program.id}/edit`}
            className={styles.editButton}
          >
            基本情報を編集
          </Link>
        </div>
      </header>

      {/* ── 基本情報 ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>基本情報</h2>
        <dl className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <dt>slug</dt>
            <dd><code className={styles.slugCode}>{program.slug}</code></dd>
          </div>
          <div className={styles.infoItem}>
            <dt>頻度</dt>
            <dd>{program.daysPerWeek}日/週</dd>
          </div>
          <div className={styles.infoItem}>
            <dt>期間</dt>
            <dd>{program.durationWeeks}週間</dd>
          </div>
          <div className={styles.infoItem}>
            <dt>総日数</dt>
            <dd>{totalDays > 0 ? `${totalDays}日` : "—"}</dd>
          </div>
          <div className={styles.infoItem}>
            <dt>総種目数</dt>
            <dd>{totalExercises > 0 ? `${totalExercises}種目` : "—"}</dd>
          </div>
          <div className={styles.infoItem}>
            <dt>作成日</dt>
            <dd>{formatDate(program.createdAt)}</dd>
          </div>
          {program.sourceProgramName && (
            <div className={styles.infoItem}>
              <dt>出典プログラム</dt>
              <dd>{program.sourceProgramName}</dd>
            </div>
          )}
          {program.sourceFidelity && (
            <div className={styles.infoItem}>
              <dt>忠実度</dt>
              <dd>{SOURCE_FIDELITY_LABEL[program.sourceFidelity] ?? program.sourceFidelity}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* ── 概要・タグ ── */}
      {(program.description || program.tags.length > 0) && (
        <section className={styles.section}>
          {program.description && (
            <div className={styles.description}>
              <h2 className={styles.sectionTitle}>概要・説明</h2>
              <p className={styles.descriptionText}>{program.description}</p>
            </div>
          )}
          {program.tags.length > 0 && (
            <div className={program.description ? styles.tagsWithTop : undefined}>
              <h2 className={styles.sectionTitle}>タグ</h2>
              <div className={styles.tagList}>
                {program.tags.map((tag) => (
                  <span key={tag.slug} className={styles.tagChip}>
                    <span className={styles.tagAxis}>{tag.axis}</span>
                    {formatProgramTagLabel(tag.slug, tag.label)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── 利用状況 ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>利用状況</h2>
        <div className={styles.statCards}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.total}</span>
            <span className={styles.statLabel}>累計選択数</span>
          </div>
          <div className={`${styles.statCard} ${stats.active > 0 ? styles.statActive : ""}`}>
            <span className={styles.statValue}>{stats.active}</span>
            <span className={styles.statLabel}>利用中</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.completed}</span>
            <span className={styles.statLabel}>完了</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.paused}</span>
            <span className={styles.statLabel}>中断</span>
          </div>
        </div>
      </section>

      {/* ── Week / Day / Exercise 構成 ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>プログラム構成</h2>

        {weeks.length === 0 ? (
          <p className={styles.empty}>Week / Day データがまだ登録されていません。</p>
        ) : (
          <div className={styles.weekList}>
            {weeks.map((week) => (
              <div key={week.id} className={styles.weekBlock}>
                <h3 className={styles.weekHeading}>
                  <WeekLabelEditor
                    weekId={week.id}
                    programId={program.id}
                    weekNumber={week.weekNumber}
                    initialLabel={week.label}
                  />
                  <span className={styles.weekMeta}>
                    {week.days.length}日
                  </span>
                </h3>

                {week.days.length === 0 ? (
                  <p className={styles.emptyDays}>この Week に Day が登録されていません。</p>
                ) : (
                  <div className={styles.dayList}>
                    {week.days.map((day) => (
                      <div key={day.id} className={styles.dayBlock}>
                        <DayInfoEditor
                          dayId={day.id}
                          programId={program.id}
                          dayNumber={day.dayNumber}
                          exerciseCount={day.exercises.length}
                          initialProgressionGuide={day.progressionGuide}
                          initialNotes={day.notes}
                        />

                        {day.exercises.length === 0 ? (
                          <p className={styles.emptyExercises}>種目がまだ登録されていません。</p>
                        ) : (
                          <div className={styles.exerciseList}>
                            {day.exercises.map((ex) => (
                              <ExerciseParamEditor
                                key={ex.id}
                                exerciseId={ex.id}
                                programId={program.id}
                                orderIndex={ex.orderIndex}
                                initialExerciseType={ex.exerciseType}
                                initialSetCount={ex.setCount}
                                initialTargetRepsText={ex.targetRepsText}
                                exerciseNameJa={ex.exerciseNameJa}
                                exerciseNameEn={ex.exerciseNameEn}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── フッター ── */}
      <div className={styles.footer}>
        <Link href="/admin/programs" className={styles.backBottom}>← プログラム管理に戻る</Link>
        <Link href={`/admin/programs/${program.id}/edit`} className={styles.editButtonBottom}>
          基本情報を編集
        </Link>
      </div>
    </main>
  );
}

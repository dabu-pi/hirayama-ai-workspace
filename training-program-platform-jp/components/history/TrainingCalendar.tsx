"use client";

import { useState } from "react";

import { jstDateSlice } from "@/lib/utils/date-jst";
import type { WorkoutSessionListItem } from "@/types/workout";

import styles from "./TrainingCalendar.module.css";

const WEEK_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

type TrainingCalendarProps = {
  sessions: WorkoutSessionListItem[];
};

function todayJst(): { year: number; month: number; dateStr: string } {
  const str = jstDateSlice(new Date().toISOString());
  const [y, m] = str.split("-").map(Number);
  return { year: y, month: m - 1, dateStr: str };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay(); // 0 = Sun
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function TrainingCalendar({ sessions }: TrainingCalendarProps) {
  const today = todayJst();
  const [viewYear, setViewYear] = useState(today.year);
  const [viewMonth, setViewMonth] = useState(today.month);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Count completed sessions per JST date string.
  // session.startedAt is already "YYYY-MM-DD" in JST (from jstDateSlice).
  const countByDate: Record<string, number> = {};
  for (const s of sessions) {
    if (s.status === "completed") {
      countByDate[s.startedAt] = (countByDate[s.startedAt] ?? 0) + 1;
    }
  }

  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
  const monthTotal = Object.entries(countByDate)
    .filter(([d]) => d.startsWith(monthPrefix))
    .reduce((sum, [, n]) => sum + n, 0);

  const firstDow = firstDayOfWeek(viewYear, viewMonth);
  const totalDays = daysInMonth(viewYear, viewMonth);
  const totalCells = Math.ceil((firstDow + totalDays) / 7) * 7;

  function goToPrevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
    setSelectedDate(null);
  }

  function goToNextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
    setSelectedDate(null);
  }

  const selectedSessions = selectedDate
    ? sessions.filter((s) => s.status === "completed" && s.startedAt === selectedDate)
    : [];

  return (
    <section className={styles.calendar}>
      {/* Header: month navigation */}
      <div className={styles.calHeader}>
        <button
          aria-label="前月"
          className={styles.navButton}
          type="button"
          onClick={goToPrevMonth}
        >
          ‹
        </button>
        <div className={styles.monthLabel}>
          <span className={styles.yearText}>{viewYear}年</span>
          <span className={styles.monthText}>{viewMonth + 1}月</span>
        </div>
        <button
          aria-label="次月"
          className={styles.navButton}
          type="button"
          onClick={goToNextMonth}
        >
          ›
        </button>
      </div>

      {/* Monthly summary */}
      <div className={styles.monthCount}>
        今月のトレーニング:{" "}
        <strong className={styles.monthCountValue}>{monthTotal}回</strong>
      </div>

      {/* Calendar grid */}
      <div className={styles.grid}>
        {WEEK_LABELS.map((label, i) => (
          <div
            key={label}
            className={[
              styles.dayHeader,
              i === 0 ? styles.sundayText : i === 6 ? styles.saturdayText : ""
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {label}
          </div>
        ))}

        {Array.from({ length: totalCells }, (_, cellIdx) => {
          const day = cellIdx - firstDow + 1;
          if (day < 1 || day > totalDays) {
            return <div key={`empty-${cellIdx}`} className={styles.emptyCell} />;
          }
          const ds = toDateStr(viewYear, viewMonth, day);
          const count = countByDate[ds] ?? 0;
          const isToday = ds === today.dateStr;
          const isSelected = ds === selectedDate;
          const dow = (firstDow + day - 1) % 7;
          return (
            <button
              key={ds}
              className={[
                styles.dayCell,
                count > 0 ? styles.hasTraining : "",
                isToday ? styles.today : "",
                isSelected ? styles.selected : "",
                dow === 0 ? styles.sundayText : dow === 6 ? styles.saturdayText : ""
              ]
                .filter(Boolean)
                .join(" ")}
              type="button"
              onClick={() => setSelectedDate(isSelected ? null : ds)}
            >
              <span className={styles.dayNumber}>{day}</span>
              {count > 0 && (
                <span className={styles.dot}>{count > 1 ? count : ""}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <div className={styles.selectedDetail}>
          <p className={styles.selectedDateLabel}>{selectedDate}</p>
          {selectedSessions.length === 0 ? (
            <p className={styles.noSession}>この日のトレーニングはありません</p>
          ) : (
            <ul className={styles.sessionList}>
              {selectedSessions.map((s) => (
                <li key={s.sessionId} className={styles.sessionItem}>
                  <span className={styles.sessionTitle}>
                    {s.programTitle ?? "フリーセッション"}
                    {s.programWeekDayLabel ? ` / ${s.programWeekDayLabel}` : ""}
                  </span>
                  <span className={styles.sessionExercises}>{s.exerciseCount} 種目</span>
                  <a className={styles.sessionLink} href={`/session-history/${s.sessionId}`}>
                    詳細 →
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

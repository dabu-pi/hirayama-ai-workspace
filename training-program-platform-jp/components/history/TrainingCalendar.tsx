"use client";

import { useState } from "react";

import { jstDateSlice } from "@/lib/utils/date-jst";
import type { CalendarDayEntry, CalendarMonthResult, WorkoutSessionListItem } from "@/types/workout";

import styles from "./TrainingCalendar.module.css";

const WEEK_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

type DaySessionResult = {
  sessions: WorkoutSessionListItem[];
  errorMessage: string | null;
};

type TrainingCalendarProps = {
  /** H-1b: lightweight month-specific entries for dot display. */
  entries: CalendarDayEntry[];
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

export function TrainingCalendar({ entries }: TrainingCalendarProps) {
  const today = todayJst();
  const [viewYear, setViewYear] = useState(today.year);
  const [viewMonth, setViewMonth] = useState(today.month);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // H-1c: currentEntries is initialized from server-side entries (today's month).
  // On month navigation, it is replaced by the API response for the target month.
  const [currentEntries, setCurrentEntries] = useState<CalendarDayEntry[]>(entries);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // H-1d: Day session data fetched from API on date selection.
  // Cached by date string to avoid re-fetching the same date.
  const [daySessions, setDaySessions] = useState<WorkoutSessionListItem[]>([]);
  const [daySessionsCache, setDaySessionsCache] = useState<Record<string, WorkoutSessionListItem[]>>({});
  const [isDayLoading, setIsDayLoading] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);

  async function fetchMonthData(year: number, month: number) {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/session-history/calendar?year=${year}&month=${month}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as CalendarMonthResult;
      if (data.errorMessage) {
        setFetchError(data.errorMessage);
      } else {
        setCurrentEntries(data.entries);
      }
    } catch {
      setFetchError("カレンダーデータを取得できませんでした");
    } finally {
      setIsLoading(false);
    }
  }

  const countByDate: Record<string, number> = {};
  for (const e of currentEntries) {
    countByDate[e.date] = e.count;
  }

  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
  const monthTotal = Object.entries(countByDate)
    .filter(([d]) => d.startsWith(monthPrefix))
    .reduce((sum, [, n]) => sum + n, 0);

  const firstDow = firstDayOfWeek(viewYear, viewMonth);
  const totalDays = daysInMonth(viewYear, viewMonth);
  const totalCells = Math.ceil((firstDow + totalDays) / 7) * 7;

  function goToPrevMonth() {
    const newYear = viewMonth === 0 ? viewYear - 1 : viewYear;
    const newMonth = viewMonth === 0 ? 11 : viewMonth - 1;
    setViewYear(newYear);
    setViewMonth(newMonth);
    setSelectedDate(null);
    setDaySessions([]);
    void fetchMonthData(newYear, newMonth);
  }

  function goToNextMonth() {
    const newYear = viewMonth === 11 ? viewYear + 1 : viewYear;
    const newMonth = viewMonth === 11 ? 0 : viewMonth + 1;
    setViewYear(newYear);
    setViewMonth(newMonth);
    setSelectedDate(null);
    setDaySessions([]);
    void fetchMonthData(newYear, newMonth);
  }

  async function fetchDaySessions(date: string) {
    if (daySessionsCache[date] !== undefined) {
      setDaySessions(daySessionsCache[date]);
      return;
    }
    setIsDayLoading(true);
    setDayError(null);
    try {
      const res = await fetch(`/api/session-history/day?date=${date}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as DaySessionResult;
      if (data.errorMessage) {
        setDayError(data.errorMessage);
        setDaySessions([]);
      } else {
        setDaySessions(data.sessions);
        setDaySessionsCache((prev) => ({ ...prev, [date]: data.sessions }));
      }
    } catch {
      setDayError("この日の履歴を取得できませんでした");
      setDaySessions([]);
    } finally {
      setIsDayLoading(false);
    }
  }

  function handleDateClick(ds: string, isSelected: boolean) {
    if (isSelected) {
      setSelectedDate(null);
      setDaySessions([]);
      setDayError(null);
    } else {
      setSelectedDate(ds);
      void fetchDaySessions(ds);
    }
  }

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
        {isLoading ? (
          <span className={styles.calendarLoading}>読み込み中...</span>
        ) : (
          <>
            {viewMonth + 1}月のトレーニング:{" "}
            <strong className={styles.monthCountValue}>{monthTotal}回</strong>
          </>
        )}
      </div>
      {fetchError && (
        <p className={styles.calendarError}>{fetchError}</p>
      )}

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
              onClick={() => handleDateClick(ds, isSelected)}
            >
              <span className={styles.dayNumber}>{day}</span>
              {count > 0 && (
                <span className={styles.dot}>{count > 1 ? count : ""}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day detail — H-1d: fetched from API, not limited to 20 sessions */}
      {selectedDate && (
        <div className={styles.selectedDetail}>
          <p className={styles.selectedDateLabel}>{selectedDate}</p>
          {isDayLoading ? (
            <p className={styles.calendarLoading}>読み込み中...</p>
          ) : dayError ? (
            <p className={styles.calendarError}>{dayError}</p>
          ) : daySessions.length === 0 ? (
            <p className={styles.noSession}>この日のトレーニングはありません</p>
          ) : (
            <ul className={styles.sessionList}>
              {daySessions.map((s) => (
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

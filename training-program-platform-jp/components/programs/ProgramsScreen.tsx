"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type {
  ProgramListItem,
  ProgramListState,
  ProgramListView,
  ProgramTag,
  ProgramTagAxis
} from "@/types/programs";

import styles from "./ProgramsScreen.module.css";

type ProgramsScreenProps = {
  state: ProgramListState;
  view: ProgramListView;
  errorMessage?: string | null;
};

function formatSourceLabel(source: ProgramListView["source"]) {
  return source === "supabase" ? "Supabase" : "mock catalog";
}

function resolveTitle(state: ProgramListState) {
  if (state === "loading") return "Loading programs";
  if (state === "error") return "Programs unavailable";
  return "Programs";
}

function resolveBody(state: ProgramListState, errorMessage: string | null | undefined) {
  if (errorMessage) return errorMessage;
  if (state === "loading") return "Preparing the current program catalog...";
  if (state === "empty") return "Programs will appear here once the catalog is ready.";
  if (state === "error") return "Please try again after refreshing the page.";
  return "Choose a program base for Train, Summary, and upcoming detail pages.";
}

const REQUIRED_TAG_AXES: ProgramTagAxis[] = ["goal", "equipment", "split"];

function findFirstTagByAxis(tags: ProgramTag[], axis: ProgramTagAxis) {
  return tags.find((tag) => tag.axis === axis) ?? null;
}

function getRequiredTags(tags: ProgramTag[]) {
  return REQUIRED_TAG_AXES.flatMap((axis) => {
    const tag = findFirstTagByAxis(tags, axis);
    return tag ? [tag] : [];
  });
}

function getOptionalFocusTag(tags: ProgramTag[]) {
  return findFirstTagByAxis(tags, "focus");
}

function deriveAvailableLevels(items: ProgramListItem[]): string[] {
  const seen = new Set<string>();
  const levels: string[] = [];
  for (const item of items) {
    if (item.level && !seen.has(item.level)) {
      seen.add(item.level);
      levels.push(item.level);
    }
  }
  return levels;
}

function deriveAvailableTags(items: ProgramListItem[]): ProgramTag[] {
  const seen = new Set<string>();
  const tags: ProgramTag[] = [];
  for (const item of items) {
    for (const tag of item.tags) {
      if (!seen.has(tag.slug)) {
        seen.add(tag.slug);
        tags.push(tag);
      }
    }
  }
  return tags.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

export function ProgramsScreen({
  state,
  view,
  errorMessage = null
}: ProgramsScreenProps) {
  const isReady = state === "ready";
  const bodyText = resolveBody(state, errorMessage);

  const [activeLevel, setActiveLevel] = useState<string | null>(null);
  const [activeTagSlug, setActiveTagSlug] = useState<string | null>(null);

  const availableLevels = useMemo(() => deriveAvailableLevels(view.items), [view.items]);
  const availableTags = useMemo(() => deriveAvailableTags(view.items), [view.items]);

  const filteredItems = useMemo(() => {
    return view.items.filter((item) => {
      if (activeLevel && item.level !== activeLevel) return false;
      if (activeTagSlug && !item.tags.some((t) => t.slug === activeTagSlug)) return false;
      return true;
    });
  }, [view.items, activeLevel, activeTagSlug]);

  const hasActiveFilter = activeLevel !== null || activeTagSlug !== null;

  function clearFilters() {
    setActiveLevel(null);
    setActiveTagSlug(null);
  }

  const showFilterBar = isReady && (availableLevels.length > 0 || availableTags.length > 0);

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>Program Library</span>
        <h1 className={styles.title}>{resolveTitle(state)}</h1>
        <p className={styles.lead}>{bodyText}</p>
        <div className={styles.heroMeta}>
          <span>Source: {formatSourceLabel(view.source)}</span>
          <Link className={styles.trainLink} href="/train">
            Go to Train
          </Link>
        </div>
      </header>

      {showFilterBar && (
        <div className={styles.filterBar}>
          {availableLevels.length > 0 && (
            <div className={styles.chipGroup}>
              {availableLevels.map((level) => (
                <button
                  className={activeLevel === level ? styles.chipActive : styles.chip}
                  key={level}
                  onClick={() => setActiveLevel(activeLevel === level ? null : level)}
                  type="button"
                >
                  {level}
                </button>
              ))}
            </div>
          )}
          {availableTags.length > 0 && (
            <div className={styles.chipGroup}>
              {availableTags.map((tag) => (
                <button
                  className={activeTagSlug === tag.slug ? styles.chipActive : styles.chip}
                  key={tag.slug}
                  onClick={() => setActiveTagSlug(activeTagSlug === tag.slug ? null : tag.slug)}
                  type="button"
                >
                  {tag.label}
                </button>
              ))}
            </div>
          )}
          {hasActiveFilter && (
            <button className={styles.clearBtn} onClick={clearFilters} type="button">
              Clear ×
            </button>
          )}
        </div>
      )}

      {!isReady ? (
        <section className={styles.statusCard}>
          <p>{bodyText}</p>
        </section>
      ) : filteredItems.length === 0 ? (
        <section className={styles.statusCard}>
          <p>
            {hasActiveFilter
              ? "No programs match the current filter. "
              : "No programs are available yet."}
            {hasActiveFilter && (
              <button className={styles.clearLink} onClick={clearFilters} type="button">
                Clear filters
              </button>
            )}
          </p>
        </section>
      ) : (
        <section className={styles.grid}>
          {filteredItems.map((program) => {
            const requiredTags = getRequiredTags(program.tags);
            const focusTag = getOptionalFocusTag(program.tags);

            return (
              <Link
                className={styles.card}
                href={`/programs/${program.slug}`}
                key={program.id}
              >
                <div className={styles.cardTop}>
                  <div>
                    <h2 className={styles.cardTitle}>{program.title}</h2>
                    <div className={styles.levelRow}>
                      <span className={styles.levelBadge}>
                        {program.level ?? "Level TBD"}
                      </span>
                      {focusTag ? (
                        <span className={styles.focusBadge}>{focusTag.label}</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <p className={styles.goalText}>{program.goal ?? "Goal TBD"}</p>

                {requiredTags.length > 0 ? (
                  <div className={styles.tagRow}>
                    {requiredTags.map((tag) => (
                      <span className={styles.tagBadge} key={`${program.id}-${tag.axis}`}>
                        {tag.label}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className={styles.metaRow}>
                  <span className={styles.metaPill}>
                    {program.frequencyLabel ?? "Frequency TBD"}
                  </span>
                  <span className={styles.metaPillSecondary}>
                    {program.durationLabel ?? "Duration TBD"}
                  </span>
                </div>

                <div className={styles.cardFooter}>
                  <span className={styles.openCta}>Open detail →</span>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}

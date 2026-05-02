import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

import {
  createSupabaseAdminClient,
  createSupabaseAnonClient,
  hasSupabasePublicEnv,
  hasSupabaseServiceRoleEnv
} from "@/lib/supabase/server";
import {
  findProgramCatalogItemBySlug,
  listProgramCatalogItems
} from "@/lib/programs/program-catalog";
import type {
  DayPreview,
  ExercisePreview,
  MethodologyType,
  ProgramCatalogItem,
  ProgramDataSource,
  ProgramLevel,
  ProgramSourceFidelity,
  ProgramTag,
  ProgramTagAxis,
  WeekPreview
} from "@/types/programs";

type DatabaseClient = SupabaseClient;

type ProgramRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_weeks: number;
  days_per_week: number;
  level: string | null;
  source_program_name: string | null;
  source_fidelity: string | null;
  source_notes: string | null;
  is_public: boolean;
  methodology: string | null;
};

type ProgramTagRow = {
  id: string;
  slug: string;
  label: string;
  axis: string;
  description: string | null;
  sort_order: number | null;
};

type ProgramTagAssignmentRow = {
  program_id: string;
  tag_id: string;
  axis: string;
};

type ProgramLibraryResult = {
  items: ProgramCatalogItem[];
  source: ProgramDataSource;
};

const PROGRAM_LEVEL_DISPLAY: Record<ProgramLevel, string> = {
  beginner: "初級",
  intermediate: "中級",
  advanced: "上級"
};

const PROGRAM_TAG_AXES: ProgramTagAxis[] = ["goal", "equipment", "split", "focus"];

// Programs are public data — use admin client (bypasses RLS) when available,
// anon client otherwise. Neither uses request cookies, so both are safe
// inside unstable_cache.
function createProgramsReadClient(): DatabaseClient {
  return hasSupabaseServiceRoleEnv()
    ? createSupabaseAdminClient()
    : createSupabaseAnonClient();
}

function isProgramTagAxis(value: string): value is ProgramTagAxis {
  return PROGRAM_TAG_AXES.includes(value as ProgramTagAxis);
}

function normalizeProgramLevel(level: string | null): ProgramLevel | null {
  const normalized = level?.trim().toLowerCase() ?? null;
  if (!normalized) return null;

  switch (normalized) {
    case "beginner":
      return "beginner";
    case "novice":
      return "beginner";
    case "intermediate":
      return "intermediate";
    case "advanced":
      return "advanced";
    default:
      return null;
  }
}

function toDisplayLevel(level: ProgramLevel | null) {
  if (!level) return null;
  return PROGRAM_LEVEL_DISPLAY[level];
}

function normalizeProgramSourceFidelity(
  fidelity: string | null
): ProgramSourceFidelity | null {
  const normalized = fidelity?.trim().toLowerCase() ?? null;
  if (!normalized) return null;

  switch (normalized) {
    case "original":
      return "original";
    case "adapted":
      return "adapted";
    case "custom":
      return "custom";
    default:
      return null;
  }
}

function buildFrequencyLabel(daysPerWeek: number | null) {
  if (!daysPerWeek || daysPerWeek <= 0) return null;
  return `${daysPerWeek}日/週`;
}

function buildDurationLabel(durationWeeks: number | null) {
  if (!durationWeeks || durationWeeks <= 0) return null;
  return `${durationWeeks}週間`;
}

function extractGoal(description: string | null) {
  const normalized = description?.trim() ?? "";
  if (!normalized) return null;

  const sentence = normalized.split(/(?<=[.!?。])/)[0]?.trim() ?? "";
  return sentence || normalized;
}

function buildOverview(description: string | null, title: string) {
  const normalized = description?.trim() ?? "";
  if (normalized) return normalized;
  return `${title}の概要はまだ登録されていません。`;
}

function mapProgramTagRow(row: ProgramTagRow): ProgramTag | null {
  if (!isProgramTagAxis(row.axis)) return null;
  return {
    slug: row.slug,
    label: row.label,
    axis: row.axis,
    description: row.description,
    sortOrder: row.sort_order ?? 0
  };
}


function createEmptyProgramTagMap(programIds: string[]) {
  return new Map<string, ProgramTag[]>(programIds.map((programId) => [programId, []]));
}

async function listProgramTagsByProgramId(
  client: DatabaseClient,
  programIds: string[]
): Promise<Map<string, ProgramTag[]>> {
  const tagsByProgramId = createEmptyProgramTagMap(programIds);
  if (programIds.length === 0) return tagsByProgramId;

  try {
    // Step 1: get assignments (program_id / tag_id / axis) — simple single-FK query
    const { data: assignmentData, error: assignmentError } = await client
      .from("program_tag_assignments")
      .select("program_id, tag_id, axis")
      .in("program_id", programIds);

    if (assignmentError) {
      console.warn("Program tag assignments could not be loaded.", assignmentError.message);
      return tagsByProgramId;
    }

    const assignments = (assignmentData ?? []) as ProgramTagAssignmentRow[];
    if (assignments.length === 0) return tagsByProgramId;

    // Step 2: fetch tag details for all referenced tag IDs
    const tagIds = [...new Set(assignments.map((a) => a.tag_id))];
    const { data: tagData, error: tagError } = await client
      .from("program_tags")
      .select("id, slug, label, axis, description, sort_order")
      .in("id", tagIds);

    if (tagError) {
      console.warn("Program tags could not be loaded.", tagError.message);
      return tagsByProgramId;
    }

    const tagRowById = new Map<string, ProgramTagRow>(
      (tagData ?? []).map((row) => [row.id as string, row as ProgramTagRow])
    );

    // Step 3: in-memory join
    for (const assignment of assignments) {
      if (!isProgramTagAxis(assignment.axis)) continue;
      const tagRow = tagRowById.get(assignment.tag_id);
      if (!tagRow) continue;
      const tag = mapProgramTagRow(tagRow);
      if (!tag || tag.axis !== assignment.axis) continue;
      tagsByProgramId.get(assignment.program_id)?.push(tag);
    }

    for (const [programId, tags] of tagsByProgramId.entries()) {
      const sortedTags = [...tags].sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }
        return left.label.localeCompare(right.label);
      });
      tagsByProgramId.set(programId, sortedTags);
    }

    return tagsByProgramId;
  } catch (error) {
    console.warn("Program metadata tags query failed. Continuing without tags.", error);
    return tagsByProgramId;
  }
}

function normalizeMethodology(value: string | null): MethodologyType {
  if (value === "linear" || value === "generic") return value;
  return "gzcl";
}

function mapProgramRow(row: ProgramRow, tags: ProgramTag[]): ProgramCatalogItem {
  const levelKey = normalizeProgramLevel(row.level);
  const sourceFidelity = normalizeProgramSourceFidelity(row.source_fidelity);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    level: toDisplayLevel(levelKey),
    levelKey,
    goal: extractGoal(row.description),
    frequencyLabel: buildFrequencyLabel(row.days_per_week),
    durationLabel: buildDurationLabel(row.duration_weeks),
    sourceProgramName: row.source_program_name,
    sourceFidelity,
    sourceNotes: row.source_notes,
    tags,
    overview: buildOverview(row.description, row.title),
    methodology: normalizeMethodology(row.methodology)
  };
}

async function listProgramsFromSupabase(): Promise<ProgramCatalogItem[]> {
  const client = createProgramsReadClient();
  const { data, error } = await client
    .from("programs")
    .select(
      "id, slug, title, description, duration_weeks, days_per_week, level, source_program_name, source_fidelity, source_notes, is_public, methodology"
    )
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load programs from Supabase: ${error.message}`);
  }

  const rows = (data ?? []) as ProgramRow[];
  const tagsByProgramId = await listProgramTagsByProgramId(
    client,
    rows.map((row) => row.id)
  );

  return rows.map((row) => mapProgramRow(row, tagsByProgramId.get(row.id) ?? []));
}

function listProgramsFromMock(): ProgramCatalogItem[] {
  return listProgramCatalogItems();
}

// Cross-request cache for the program library (1 hour TTL).
// Programs change only on deployment, so staleness is acceptable.
// createProgramsReadClient uses admin/anon client (no cookies) → safe here.
const listProgramsFromSupabaseCached = unstable_cache(
  listProgramsFromSupabase,
  ["program-library"],
  { revalidate: 3600 }
);

export async function getProgramLibrary(): Promise<ProgramLibraryResult> {
  if (!hasSupabasePublicEnv()) {
    return {
      items: listProgramsFromMock(),
      source: "mock_catalog"
    };
  }

  try {
    return {
      items: await listProgramsFromSupabaseCached(),
      source: "supabase"
    };
  } catch (error) {
    console.error("Falling back to mock catalog after Supabase program read failure.", error);
    return {
      items: listProgramsFromMock(),
      source: "mock_catalog"
    };
  }
}

type FirstDayWeekRow = { id: string };
type FirstDayRow = { id: string };

/**
 * Returns the UUID of week 1 / day 1 for the given program, or null if not found.
 * Only queries Supabase; returns null when env is unavailable.
 */
export async function findFirstProgramDayId(programId: string): Promise<string | null> {
  if (!hasSupabasePublicEnv()) return null;

  try {
    const client = createProgramsReadClient();

    const { data: weekData, error: weekError } = await client
      .from("program_weeks")
      .select("id")
      .eq("program_id", programId)
      .eq("week_number", 1)
      .maybeSingle<FirstDayWeekRow>();

    if (weekError || !weekData) return null;

    const { data: dayData, error: dayError } = await client
      .from("program_days")
      .select("id")
      .eq("program_week_id", weekData.id)
      .eq("day_number", 1)
      .maybeSingle<FirstDayRow>();

    if (dayError || !dayData) return null;

    return dayData.id;
  } catch {
    return null;
  }
}

type WeekRow = { id: string; week_number: number; label: string | null };
type DayRow = { id: string; day_number: number; program_week_id: string };
type DayExerciseRow = {
  program_day_id: string;
  exercise_type: string;
  order_index: number;
  // PostgREST many-to-one join returns a single object (not array)
  exercises: { name_en: string; name_ja: string | null } | { name_en: string; name_ja: string | null }[] | null;
};

/**
 * Returns the week-by-week structure for a program: weeks → days → exercises (name + type).
 * Returns an empty array when Supabase is unavailable or the query fails.
 */
export async function getProgramWeekPreviews(
  programId: string
): Promise<WeekPreview[]> {
  if (!hasSupabasePublicEnv()) return [];

  try {
    const client = createProgramsReadClient();

    const { data: weekData, error: weekError } = await client
      .from("program_weeks")
      .select("id, week_number, label")
      .eq("program_id", programId)
      .order("week_number", { ascending: true });

    if (weekError || !weekData || weekData.length === 0) return [];

    const weeks = weekData as WeekRow[];
    const weekIds = weeks.map((w) => w.id);

    const { data: dayData, error: dayError } = await client
      .from("program_days")
      .select("id, day_number, program_week_id")
      .in("program_week_id", weekIds)
      .order("day_number", { ascending: true });

    if (dayError || !dayData || dayData.length === 0) return [];

    const days = dayData as DayRow[];
    const dayIds = days.map((d) => d.id);

    const { data: exData, error: exError } = await client
      .from("program_day_exercises")
      .select("program_day_id, exercise_type, order_index, exercises(name_en, name_ja)")
      .in("program_day_id", dayIds)
      .order("order_index", { ascending: true });

    if (exError) return [];

    const exercisesByDayId = new Map<string, ExercisePreview[]>();
    for (const row of (exData ?? []) as DayExerciseRow[]) {
      if (!exercisesByDayId.has(row.program_day_id)) {
        exercisesByDayId.set(row.program_day_id, []);
      }
      const exField = row.exercises;
      const nameEn = exField
        ? Array.isArray(exField)
          ? (exField[0]?.name_en ?? "Unknown")
          : exField.name_en
        : "Unknown";
      const nameJa = exField
        ? Array.isArray(exField)
          ? (exField[0]?.name_ja ?? null)
          : exField.name_ja
        : null;
      exercisesByDayId.get(row.program_day_id)!.push({
        nameEn,
        nameJa,
        exerciseType: row.exercise_type ?? null
      });
    }

    const daysByWeekId = new Map<string, DayPreview[]>();
    for (const day of days) {
      if (!daysByWeekId.has(day.program_week_id)) {
        daysByWeekId.set(day.program_week_id, []);
      }
      daysByWeekId.get(day.program_week_id)!.push({
        dayNumber: day.day_number,
        exercises: exercisesByDayId.get(day.id) ?? []
      });
    }

    return weeks.map((week) => ({
      weekNumber: week.week_number,
      label: week.label ?? null,
      days: daysByWeekId.get(week.id) ?? []
    }));
  } catch {
    return [];
  }
}

export async function findProgramBySlug(
  programSlug: string
): Promise<{ program: ProgramCatalogItem | null; source: ProgramDataSource }> {
  const library = await getProgramLibrary();
  const program =
    library.items.find((item) => item.slug === programSlug) ??
    (library.source === "mock_catalog"
      ? findProgramCatalogItemBySlug(programSlug)
      : null);

  return {
    program: program ?? null,
    source: library.source
  };
}

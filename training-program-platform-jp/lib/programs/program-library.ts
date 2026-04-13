import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasSupabasePublicEnv,
  hasSupabaseServiceRoleEnv
} from "@/lib/supabase/server";
import {
  findProgramCatalogItemBySlug,
  listProgramCatalogItems
} from "@/lib/programs/program-catalog";
import type {
  ProgramCatalogItem,
  ProgramDataSource,
  ProgramLevel,
  ProgramTag,
  ProgramTagAxis
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
  is_public: boolean;
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
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced"
};

const PROGRAM_TAG_AXES: ProgramTagAxis[] = ["goal", "equipment", "split", "focus"];

function createProgramsReadClient(): DatabaseClient {
  return hasSupabaseServiceRoleEnv()
    ? createSupabaseAdminClient()
    : createSupabaseServerClient();
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

function buildFrequencyLabel(daysPerWeek: number | null) {
  if (!daysPerWeek || daysPerWeek <= 0) return null;
  return `${daysPerWeek} days / week`;
}

function buildDurationLabel(durationWeeks: number | null) {
  if (!durationWeeks || durationWeeks <= 0) return null;
  return `${durationWeeks} weeks`;
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
  return `${title} overview is not available in Supabase yet.`;
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

function mapProgramRow(row: ProgramRow, tags: ProgramTag[]): ProgramCatalogItem {
  const levelKey = normalizeProgramLevel(row.level);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    level: toDisplayLevel(levelKey),
    levelKey,
    goal: extractGoal(row.description),
    frequencyLabel: buildFrequencyLabel(row.days_per_week),
    durationLabel: buildDurationLabel(row.duration_weeks),
    tags,
    overview: buildOverview(row.description, row.title)
  };
}

async function listProgramsFromSupabase(): Promise<ProgramCatalogItem[]> {
  const client = createProgramsReadClient();
  const { data, error } = await client
    .from("programs")
    .select(
      "id, slug, title, description, duration_weeks, days_per_week, level, is_public"
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

export async function getProgramLibrary(): Promise<ProgramLibraryResult> {
  if (!hasSupabasePublicEnv()) {
    return {
      items: listProgramsFromMock(),
      source: "mock_catalog"
    };
  }

  try {
    return {
      items: await listProgramsFromSupabase(),
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

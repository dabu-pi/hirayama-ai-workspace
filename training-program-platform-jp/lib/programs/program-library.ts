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
import type { ProgramCatalogItem, ProgramDataSource } from "@/types/programs";

type DatabaseClient = SupabaseClient;

type ProgramRow = {
  id: string;
  title: string;
  description: string | null;
  duration_weeks: number;
  days_per_week: number;
  level: string | null;
  is_public: boolean;
};

type ProgramLibraryResult = {
  items: ProgramCatalogItem[];
  source: ProgramDataSource;
};

function createProgramsReadClient(): DatabaseClient {
  return hasSupabaseServiceRoleEnv()
    ? createSupabaseAdminClient()
    : createSupabaseServerClient();
}

function slugifySegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildProgramSlug(row: ProgramRow) {
  const titleSlug = slugifySegment(row.title);
  const fallbackSlug = titleSlug || "program";
  return `${fallbackSlug}--${row.id.slice(0, 8)}`;
}

function toDisplayLevel(level: string | null) {
  if (!level) return null;
  if (level.length <= 1) return level.toUpperCase();
  return `${level[0].toUpperCase()}${level.slice(1)}`;
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

function mapProgramRow(row: ProgramRow): ProgramCatalogItem {
  return {
    id: row.id,
    slug: buildProgramSlug(row),
    title: row.title,
    level: toDisplayLevel(row.level),
    goal: extractGoal(row.description),
    frequencyLabel: buildFrequencyLabel(row.days_per_week),
    durationLabel: buildDurationLabel(row.duration_weeks),
    overview: buildOverview(row.description, row.title)
  };
}

async function listProgramsFromSupabase(): Promise<ProgramCatalogItem[]> {
  const client = createProgramsReadClient();
  const { data, error } = await client
    .from("programs")
    .select(
      "id, title, description, duration_weeks, days_per_week, level, is_public"
    )
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load programs from Supabase: ${error.message}`);
  }

  return ((data ?? []) as ProgramRow[]).map(mapProgramRow);
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

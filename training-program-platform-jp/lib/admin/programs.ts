import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type AdminProgramTag = {
  slug: string;
  label: string;
  axis: string;
};

export type AdminProgramRow = {
  id: string;
  slug: string;
  title: string;
  level: string | null;
  isPublic: boolean;
  durationWeeks: number;
  daysPerWeek: number;
  methodology: string | null;
  createdAt: string;
  totalEnrollments: number;
  activeEnrollments: number;
  totalDays: number;
  totalExercises: number;
  tags: AdminProgramTag[];
};

type ProgramRow = {
  id: string;
  slug: string;
  title: string;
  level: string | null;
  is_public: boolean;
  duration_weeks: number;
  days_per_week: number;
  methodology: string | null;
  created_at: string;
};

type EnrollmentRow = {
  program_id: string;
  status: string;
  archived_at: string | null;
};

type WeekRow = { id: string; program_id: string };
type DayRow  = { id: string; program_week_id: string };
type DayExerciseRow = { program_day_id: string };

type TagRow = { id: string; slug: string; label: string; axis: string };
type TagAssignmentRow = { program_id: string; tag_id: string; axis: string };

/**
 * Returns all programs (including non-public) with enrollment counts,
 * day/exercise totals, and tags — for admin use only.
 * Uses 5 parallel queries + 2 sequential (day → exercises) to avoid N+1.
 */
export async function getAdminProgramList(): Promise<AdminProgramRow[]> {
  const admin = createSupabaseAdminClient();

  // Batch 1: all independent queries in parallel
  const [
    programsResult,
    enrollmentsResult,
    weeksResult,
    tagAssignmentsResult,
    tagsResult
  ] = await Promise.all([
    admin
      .from("programs")
      .select(
        "id, slug, title, level, is_public, duration_weeks, days_per_week, methodology, created_at"
      )
      .order("created_at", { ascending: false }),
    admin
      .from("program_enrollments")
      .select("program_id, status, archived_at"),
    admin
      .from("program_weeks")
      .select("id, program_id"),
    admin
      .from("program_tag_assignments")
      .select("program_id, tag_id, axis"),
    admin
      .from("program_tags")
      .select("id, slug, label, axis")
  ]);

  if (programsResult.error) {
    console.error("getAdminProgramList: programs query failed.", programsResult.error.message);
    return [];
  }

  const programs = (programsResult.data ?? []) as ProgramRow[];
  if (programs.length === 0) return [];

  const weeks = (weeksResult.data ?? []) as WeekRow[];
  const weekIds = weeks.map((w) => w.id);

  // Batch 2: program_days (needs weekIds from batch 1)
  const daysResult = weekIds.length > 0
    ? await admin
        .from("program_days")
        .select("id, program_week_id")
        .in("program_week_id", weekIds)
    : { data: [] as DayRow[], error: null };

  const days = (daysResult.data ?? []) as DayRow[];
  const dayIds = days.map((d) => d.id);

  // Batch 3: program_day_exercises (needs dayIds from batch 2)
  const exercisesResult = dayIds.length > 0
    ? await admin
        .from("program_day_exercises")
        .select("program_day_id")
        .in("program_day_id", dayIds)
    : { data: [] as DayExerciseRow[], error: null };

  const dayExercises = (exercisesResult.data ?? []) as DayExerciseRow[];

  // ── Build lookup maps ──────────────────────────────────────────

  // week_id → program_id
  const weekToProgramId = new Map<string, string>();
  for (const w of weeks) weekToProgramId.set(w.id, w.program_id);

  // day_id → program_id (via week)
  const dayToProgramId = new Map<string, string>();
  for (const d of days) {
    const programId = weekToProgramId.get(d.program_week_id);
    if (programId) dayToProgramId.set(d.id, programId);
  }

  // Enrollment counts: total + active (non-archived)
  const enrollmentMap = new Map<string, { total: number; active: number }>();
  for (const p of programs) enrollmentMap.set(p.id, { total: 0, active: 0 });
  for (const e of (enrollmentsResult.data ?? []) as EnrollmentRow[]) {
    const entry = enrollmentMap.get(e.program_id);
    if (!entry) continue;
    entry.total++;
    if (e.status === "active" && e.archived_at === null) entry.active++;
  }

  // Day counts per program
  const dayCountMap = new Map<string, number>();
  for (const d of days) {
    const programId = weekToProgramId.get(d.program_week_id);
    if (!programId) continue;
    dayCountMap.set(programId, (dayCountMap.get(programId) ?? 0) + 1);
  }

  // Exercise counts per program
  const exerciseCountMap = new Map<string, number>();
  for (const e of dayExercises) {
    const programId = dayToProgramId.get(e.program_day_id);
    if (!programId) continue;
    exerciseCountMap.set(programId, (exerciseCountMap.get(programId) ?? 0) + 1);
  }

  // Tags per program
  const tagRowById = new Map<string, AdminProgramTag>();
  for (const t of (tagsResult.data ?? []) as TagRow[]) {
    tagRowById.set(t.id, { slug: t.slug, label: t.label, axis: t.axis });
  }
  const tagsByProgramId = new Map<string, AdminProgramTag[]>();
  for (const p of programs) tagsByProgramId.set(p.id, []);
  for (const a of (tagAssignmentsResult.data ?? []) as TagAssignmentRow[]) {
    const tag = tagRowById.get(a.tag_id);
    if (!tag) continue;
    tagsByProgramId.get(a.program_id)?.push(tag);
  }

  return programs.map<AdminProgramRow>((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    level: p.level,
    isPublic: p.is_public,
    durationWeeks: p.duration_weeks,
    daysPerWeek: p.days_per_week,
    methodology: p.methodology,
    createdAt: p.created_at,
    totalEnrollments: enrollmentMap.get(p.id)?.total ?? 0,
    activeEnrollments: enrollmentMap.get(p.id)?.active ?? 0,
    totalDays: dayCountMap.get(p.id) ?? 0,
    totalExercises: exerciseCountMap.get(p.id) ?? 0,
    tags: tagsByProgramId.get(p.id) ?? []
  }));
}

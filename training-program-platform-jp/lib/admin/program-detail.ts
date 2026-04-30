import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { AdminProgramTag } from "@/lib/admin/programs";

export type AdminProgramExerciseDetail = {
  id: string;
  orderIndex: number;
  exerciseType: string;
  exerciseNameJa: string;
  exerciseNameEn: string;
  exerciseSlug: string;
  setCount: number;
  targetRepsText: string | null;
};

export type AdminProgramDayDetail = {
  id: string;
  dayNumber: number;
  progressionGuide: string | null;
  notes: string | null;
  exercises: AdminProgramExerciseDetail[];
};

export type AdminProgramWeekDetail = {
  id: string;
  weekNumber: number;
  label: string | null;
  days: AdminProgramDayDetail[];
};

export type AdminProgramEnrollmentStats = {
  total: number;
  active: number;
  completed: number;
  paused: number;
};

export type AdminProgramDetail = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  isPublic: boolean;
  durationWeeks: number;
  daysPerWeek: number;
  methodology: string | null;
  sourceProgramName: string | null;
  sourceFidelity: string | null;
  createdAt: string;
  tags: AdminProgramTag[];
  enrollmentStats: AdminProgramEnrollmentStats;
  weeks: AdminProgramWeekDetail[];
};

// ── Internal row types ──────────────────────────────────────────

type ProgramDetailRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  is_public: boolean;
  duration_weeks: number;
  days_per_week: number;
  methodology: string | null;
  source_program_name: string | null;
  source_fidelity: string | null;
  created_at: string;
};

type EnrollmentStatRow = { status: string; archived_at: string | null };
type WeekDetailRow     = { id: string; week_number: number; label: string | null };
type DayDetailRow      = {
  id: string;
  program_week_id: string;
  day_number: number;
  progression_guide: string | null;
  notes: string | null;
};

type ExerciseJoinField = { id: string; slug: string; name_ja: string; name_en: string } | null;

type DayExerciseDetailRow = {
  id: string;
  program_day_id: string;
  exercise_type: string;
  set_count: number;
  target_reps_text: string | null;
  order_index: number;
  exercises: ExerciseJoinField | ExerciseJoinField[];
};

type TagRow           = { id: string; slug: string; label: string; axis: string };
type TagAssignmentRow = { tag_id: string; axis: string };

/**
 * Returns full program detail for admin view, including Week/Day/Exercise tree.
 * Returns null when the programId is not found or query fails.
 * Uses 5 parallel queries + 2 sequential to avoid N+1.
 */
export async function getAdminProgramDetail(
  programId: string
): Promise<AdminProgramDetail | null> {
  const admin = createSupabaseAdminClient();

  // Batch 1: all parallel
  const [
    programResult,
    enrollmentsResult,
    weeksResult,
    tagAssignResult,
    tagsResult
  ] = await Promise.all([
    admin
      .from("programs")
      .select(
        "id, slug, title, description, level, is_public, duration_weeks, days_per_week, methodology, source_program_name, source_fidelity, created_at"
      )
      .eq("id", programId)
      .maybeSingle<ProgramDetailRow>(),
    admin
      .from("program_enrollments")
      .select("status, archived_at")
      .eq("program_id", programId),
    admin
      .from("program_weeks")
      .select("id, week_number, label")
      .eq("program_id", programId)
      .order("week_number", { ascending: true }),
    admin
      .from("program_tag_assignments")
      .select("tag_id, axis")
      .eq("program_id", programId),
    admin
      .from("program_tags")
      .select("id, slug, label, axis")
  ]);

  if (programResult.error || !programResult.data) {
    console.error(
      "getAdminProgramDetail: program not found or query failed.",
      programResult.error?.message ?? "no data"
    );
    return null;
  }

  const program = programResult.data;
  const weeks   = (weeksResult.data ?? []) as WeekDetailRow[];
  const weekIds = weeks.map((w) => w.id);

  // Batch 2: program_days (needs weekIds)
  const daysResult = weekIds.length > 0
    ? await admin
        .from("program_days")
        .select("id, program_week_id, day_number, progression_guide, notes")
        .in("program_week_id", weekIds)
        .order("day_number", { ascending: true })
    : { data: [] as DayDetailRow[], error: null };

  const days   = (daysResult.data ?? []) as DayDetailRow[];
  const dayIds = days.map((d) => d.id);

  // Batch 3: exercises with join (needs dayIds)
  const dayExercisesResult = dayIds.length > 0
    ? await admin
        .from("program_day_exercises")
        .select(
          "id, program_day_id, exercise_type, set_count, target_reps_text, order_index, exercises(id, slug, name_ja, name_en)"
        )
        .in("program_day_id", dayIds)
        .order("order_index", { ascending: true })
    : { data: [] as unknown as DayExerciseDetailRow[], error: null };

  const dayExercises = (dayExercisesResult.data ?? []) as unknown as DayExerciseDetailRow[];

  // ── Tags ──
  const tagRowById = new Map<string, AdminProgramTag>();
  for (const t of (tagsResult.data ?? []) as TagRow[]) {
    tagRowById.set(t.id, { slug: t.slug, label: t.label, axis: t.axis });
  }
  const tags: AdminProgramTag[] = [];
  for (const a of (tagAssignResult.data ?? []) as TagAssignmentRow[]) {
    const tag = tagRowById.get(a.tag_id);
    if (tag) tags.push(tag);
  }

  // ── Enrollment stats ──
  const enrollmentStats: AdminProgramEnrollmentStats = {
    total: 0,
    active: 0,
    completed: 0,
    paused: 0
  };
  for (const e of (enrollmentsResult.data ?? []) as EnrollmentStatRow[]) {
    enrollmentStats.total++;
    if (e.status === "active" && e.archived_at === null) enrollmentStats.active++;
    else if (e.status === "completed") enrollmentStats.completed++;
    else if (e.status === "paused") enrollmentStats.paused++;
  }

  // ── Exercises per day ──
  const exercisesByDayId = new Map<string, AdminProgramExerciseDetail[]>();
  for (const d of days) exercisesByDayId.set(d.id, []);

  for (const de of dayExercises) {
    const exField = de.exercises;
    const ex = Array.isArray(exField) ? exField[0] : exField;
    exercisesByDayId.get(de.program_day_id)?.push({
      id: de.id,
      orderIndex: de.order_index,
      exerciseType: de.exercise_type,
      exerciseNameJa: ex?.name_ja ?? "不明",
      exerciseNameEn: ex?.name_en ?? "Unknown",
      exerciseSlug: ex?.slug ?? "",
      setCount: de.set_count,
      targetRepsText: de.target_reps_text
    });
  }

  // ── Days per week ──
  const daysByWeekId = new Map<string, AdminProgramDayDetail[]>();
  for (const w of weeks) daysByWeekId.set(w.id, []);

  for (const d of days) {
    daysByWeekId.get(d.program_week_id)?.push({
      id: d.id,
      dayNumber: d.day_number,
      progressionGuide: d.progression_guide,
      notes: d.notes,
      exercises: exercisesByDayId.get(d.id) ?? []
    });
  }

  return {
    id: program.id,
    slug: program.slug,
    title: program.title,
    description: program.description,
    level: program.level,
    isPublic: program.is_public,
    durationWeeks: program.duration_weeks,
    daysPerWeek: program.days_per_week,
    methodology: program.methodology,
    sourceProgramName: program.source_program_name,
    sourceFidelity: program.source_fidelity,
    createdAt: program.created_at,
    tags,
    enrollmentStats,
    weeks: weeks.map((w) => ({
      id: w.id,
      weekNumber: w.week_number,
      label: w.label,
      days: daysByWeekId.get(w.id) ?? []
    }))
  };
}

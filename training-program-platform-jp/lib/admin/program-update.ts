"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient
} from "@/lib/supabase/server";

export type ProgramUpdateInput = {
  title: string;
  description: string | null;
  level: string | null;
  methodology: string | null;
  isPublic: boolean;
  durationWeeks: number;
  daysPerWeek: number;
};

export type ProgramUpdateResult = {
  ok: boolean;
  error?: string;
  /** slug after save — confirmed unchanged when only basic fields are updated */
  slug?: string;
};

/** Returns the authenticated user's ID only when role = 'admin'. */
async function requireAdminUserId(): Promise<string | null> {
  const client = createSupabaseServerClient();
  const {
    data: { user }
  } = await client.auth.getUser();
  if (!user) return null;
  const { data } = await client
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string }>();
  return data?.role === "admin" ? user.id : null;
}

/**
 * Updates basic program info (title / description / level / methodology /
 * is_public / duration_weeks / days_per_week).
 *
 * Slug behavior: the DB trigger `trg_programs_assign_slug` fires on
 * UPDATE OF title but uses `new.slug` (the existing value) as the slug
 * source, so the slug remains unchanged after a title-only edit.
 *
 * Week / Day / Exercise data is never touched by this action.
 * updated_at column does not exist; no migration is needed.
 */
export async function updateProgramBasicInfo(
  programId: string,
  input: ProgramUpdateInput
): Promise<ProgramUpdateResult> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return { ok: false, error: "forbidden" };

  // Server-side validation
  const title = input.title.trim();
  if (!title) return { ok: false, error: "title_required" };

  const durationWeeks = Math.round(input.durationWeeks);
  const daysPerWeek = Math.round(input.daysPerWeek);
  if (durationWeeks < 1 || durationWeeks > 52) {
    return { ok: false, error: "invalid_duration_weeks" };
  }
  if (daysPerWeek < 1 || daysPerWeek > 7) {
    return { ok: false, error: "invalid_days_per_week" };
  }

  const validLevels = ["beginner", "intermediate", "advanced"];
  const level = input.level && validLevels.includes(input.level) ? input.level : null;

  const validMethodologies = ["gzcl", "linear", "generic"];
  const methodology =
    input.methodology && validMethodologies.includes(input.methodology)
      ? input.methodology
      : null;

  const admin = createSupabaseAdminClient();

  // Verify program exists
  const { data: existing, error: fetchErr } = await admin
    .from("programs")
    .select("id, slug")
    .eq("id", programId)
    .maybeSingle<{ id: string; slug: string }>();

  if (fetchErr || !existing) {
    return { ok: false, error: fetchErr?.message ?? "program_not_found" };
  }

  // Update basic fields only — no slug column in SET clause
  const { error: updateErr } = await admin
    .from("programs")
    .update({
      title,
      description: input.description?.trim() || null,
      level,
      methodology,
      is_public: input.isPublic,
      duration_weeks: durationWeeks,
      days_per_week: daysPerWeek
    })
    .eq("id", programId);

  if (updateErr) {
    console.error("updateProgramBasicInfo: update failed", {
      programId,
      error: updateErr.message
    });
    return { ok: false, error: updateErr.message };
  }

  // Confirm slug after save (expected: unchanged)
  const { data: after } = await admin
    .from("programs")
    .select("slug")
    .eq("id", programId)
    .maybeSingle<{ slug: string }>();

  // Invalidate program library cache (1h TTL via unstable_cache tag "program-library")
  revalidateTag("program-library");
  // Invalidate page caches
  revalidatePath("/programs");
  revalidatePath("/admin/programs");
  revalidatePath(`/admin/programs/${programId}`);

  return { ok: true, slug: after?.slug ?? existing.slug };
}

// ── Week label ──────────────────────────────────────────────────

export type WeekLabelUpdateResult = {
  ok: boolean;
  error?: string;
};

/**
 * Updates program_weeks.label for a single week.
 * Verifies the week belongs to the given program before updating.
 * label = null clears the label (week shows as "X週目" only).
 */
export async function updateProgramWeekLabel(
  weekId: string,
  programId: string,
  label: string | null
): Promise<WeekLabelUpdateResult> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return { ok: false, error: "forbidden" };

  const trimmedLabel = typeof label === "string" ? label.trim() || null : null;
  if (trimmedLabel !== null && trimmedLabel.length > 100) {
    return { ok: false, error: "label_too_long" };
  }

  const admin = createSupabaseAdminClient();

  const { data: week, error: fetchErr } = await admin
    .from("program_weeks")
    .select("id")
    .eq("id", weekId)
    .eq("program_id", programId)
    .maybeSingle<{ id: string }>();

  if (fetchErr || !week) {
    return { ok: false, error: "week_not_found" };
  }

  const { error: updateErr } = await admin
    .from("program_weeks")
    .update({ label: trimmedLabel })
    .eq("id", weekId);

  if (updateErr) {
    console.error("updateProgramWeekLabel: update failed", {
      weekId,
      error: updateErr.message
    });
    return { ok: false, error: updateErr.message };
  }

  revalidatePath(`/admin/programs/${programId}`);

  return { ok: true };
}

// ── Day info ──────────────────────────────────────────────────

export type DayInfoUpdateResult = {
  ok: boolean;
  error?: string;
};

/**
 * Updates program_days.progression_guide and notes for a single day.
 * Verifies the day belongs to the given program (via program_weeks) before updating.
 * null values clear the respective fields.
 */
export async function updateProgramDayInfo(
  dayId: string,
  programId: string,
  progressionGuide: string | null,
  notes: string | null
): Promise<DayInfoUpdateResult> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return { ok: false, error: "forbidden" };

  const trimmedGuide =
    typeof progressionGuide === "string" ? progressionGuide.trim() || null : null;
  const trimmedNotes =
    typeof notes === "string" ? notes.trim() || null : null;

  if (trimmedGuide !== null && trimmedGuide.length > 1000) {
    return { ok: false, error: "progression_guide_too_long" };
  }
  if (trimmedNotes !== null && trimmedNotes.length > 1000) {
    return { ok: false, error: "notes_too_long" };
  }

  const admin = createSupabaseAdminClient();

  // Fetch day to get week id
  const { data: day, error: dayFetchErr } = await admin
    .from("program_days")
    .select("id, program_week_id")
    .eq("id", dayId)
    .maybeSingle<{ id: string; program_week_id: string }>();

  if (dayFetchErr || !day) {
    return { ok: false, error: "day_not_found" };
  }

  // Verify week belongs to program
  const { data: week, error: weekFetchErr } = await admin
    .from("program_weeks")
    .select("id")
    .eq("id", day.program_week_id)
    .eq("program_id", programId)
    .maybeSingle<{ id: string }>();

  if (weekFetchErr || !week) {
    return { ok: false, error: "day_not_found" };
  }

  const { error: updateErr } = await admin
    .from("program_days")
    .update({ progression_guide: trimmedGuide, notes: trimmedNotes })
    .eq("id", dayId);

  if (updateErr) {
    console.error("updateProgramDayInfo: update failed", {
      dayId,
      error: updateErr.message
    });
    return { ok: false, error: updateErr.message };
  }

  revalidatePath(`/admin/programs/${programId}`);

  return { ok: true };
}

// ── Exercise params ──────────────────────────────────────────────

export type ExerciseParamUpdateResult = {
  ok: boolean;
  error?: string;
};

const VALID_EXERCISE_TYPES = ["T1", "T2", "T3"] as const;

/**
 * Updates exercise_type / set_count / target_reps_text for a single exercise.
 * Verifies ownership via: program_day_exercises → program_days → program_weeks → programs.
 */
export async function updateExerciseParams(
  exerciseId: string,
  programId: string,
  exerciseType: string,
  setCount: number,
  targetRepsText: string | null
): Promise<ExerciseParamUpdateResult> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return { ok: false, error: "forbidden" };

  if (!(VALID_EXERCISE_TYPES as readonly string[]).includes(exerciseType)) {
    return { ok: false, error: "invalid_exercise_type" };
  }

  const count = Math.round(setCount);
  if (count < 1 || count > 20) {
    return { ok: false, error: "invalid_set_count" };
  }

  const trimmedReps =
    typeof targetRepsText === "string" ? targetRepsText.trim() || null : null;
  if (trimmedReps !== null && trimmedReps.length > 100) {
    return { ok: false, error: "reps_too_long" };
  }

  const admin = createSupabaseAdminClient();

  // Step 1: exercise → dayId
  const { data: exercise, error: exFetchErr } = await admin
    .from("program_day_exercises")
    .select("id, program_day_id")
    .eq("id", exerciseId)
    .maybeSingle<{ id: string; program_day_id: string }>();

  if (exFetchErr || !exercise) {
    return { ok: false, error: "exercise_not_found" };
  }

  // Step 2: day → weekId
  const { data: day, error: dayFetchErr } = await admin
    .from("program_days")
    .select("id, program_week_id")
    .eq("id", exercise.program_day_id)
    .maybeSingle<{ id: string; program_week_id: string }>();

  if (dayFetchErr || !day) {
    return { ok: false, error: "exercise_not_found" };
  }

  // Step 3: verify week belongs to program
  const { data: week, error: weekFetchErr } = await admin
    .from("program_weeks")
    .select("id")
    .eq("id", day.program_week_id)
    .eq("program_id", programId)
    .maybeSingle<{ id: string }>();

  if (weekFetchErr || !week) {
    return { ok: false, error: "exercise_not_found" };
  }

  const { error: updateErr } = await admin
    .from("program_day_exercises")
    .update({
      exercise_type: exerciseType,
      set_count: count,
      target_reps_text: trimmedReps
    })
    .eq("id", exerciseId);

  if (updateErr) {
    console.error("updateExerciseParams: update failed", {
      exerciseId,
      error: updateErr.message
    });
    return { ok: false, error: updateErr.message };
  }

  revalidatePath(`/admin/programs/${programId}`);

  return { ok: true };
}

// ── Exercise order swap ──────────────────────────────────────────

export type SwapExerciseOrderResult = {
  ok: boolean;
  error?: string;
};

/**
 * Swaps order_index between two exercises in the same Day.
 * Uses a 3-step swap via a large temporary index (999999) to remain safe
 * even when a unique constraint exists on (program_day_id, order_index).
 * Verifies both exercises belong to the same day and to the given program.
 */
export async function swapExerciseOrder(
  exerciseIdA: string,
  exerciseIdB: string,
  programId: string
): Promise<SwapExerciseOrderResult> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();

  // Fetch both exercises in parallel
  const [{ data: exA }, { data: exB }] = await Promise.all([
    admin
      .from("program_day_exercises")
      .select("id, program_day_id, order_index")
      .eq("id", exerciseIdA)
      .maybeSingle<{ id: string; program_day_id: string; order_index: number }>(),
    admin
      .from("program_day_exercises")
      .select("id, program_day_id, order_index")
      .eq("id", exerciseIdB)
      .maybeSingle<{ id: string; program_day_id: string; order_index: number }>(),
  ]);

  if (!exA || !exB) return { ok: false, error: "exercise_not_found" };
  if (exA.program_day_id !== exB.program_day_id) {
    return { ok: false, error: "different_day" };
  }

  // Verify day → week → program
  const { data: day } = await admin
    .from("program_days")
    .select("program_week_id")
    .eq("id", exA.program_day_id)
    .maybeSingle<{ program_week_id: string }>();

  if (!day) return { ok: false, error: "exercise_not_found" };

  const { data: week } = await admin
    .from("program_weeks")
    .select("id")
    .eq("id", day.program_week_id)
    .eq("program_id", programId)
    .maybeSingle<{ id: string }>();

  if (!week) return { ok: false, error: "exercise_not_found" };

  // 3-step swap to handle potential unique constraint on (program_day_id, order_index)
  const TEMP_INDEX = 999999;

  const { error: e1 } = await admin
    .from("program_day_exercises")
    .update({ order_index: TEMP_INDEX })
    .eq("id", exerciseIdA);
  if (e1) return { ok: false, error: e1.message };

  const { error: e2 } = await admin
    .from("program_day_exercises")
    .update({ order_index: exA.order_index })
    .eq("id", exerciseIdB);
  if (e2) {
    await admin
      .from("program_day_exercises")
      .update({ order_index: exA.order_index })
      .eq("id", exerciseIdA);
    return { ok: false, error: e2.message };
  }

  const { error: e3 } = await admin
    .from("program_day_exercises")
    .update({ order_index: exB.order_index })
    .eq("id", exerciseIdA);
  if (e3) return { ok: false, error: e3.message };

  revalidatePath(`/admin/programs/${programId}`);

  return { ok: true };
}

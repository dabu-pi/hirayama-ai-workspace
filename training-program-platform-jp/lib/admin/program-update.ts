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

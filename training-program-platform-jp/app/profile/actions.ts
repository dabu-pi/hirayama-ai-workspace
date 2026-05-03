"use server";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";

/**
 * Updates the authenticated user's own display_name.
 *
 * Security:
 *   - Identity is verified via auth.getUser() (cookie-based JWT — cannot be spoofed).
 *   - Only display_name is written. member_name, membership_status, email, role
 *     are never touched, even if the caller passes extra data.
 *   - The UPDATE is scoped to WHERE id = user.id so other users' rows are safe.
 */
export async function updateOwnDisplayName(
  newDisplayName: string
): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabasePublicEnv()) {
    return { ok: false, error: "unavailable" };
  }

  const client = createSupabaseServerClient();
  const {
    data: { user }
  } = await client.auth.getUser();

  if (!user) {
    console.warn("updateOwnDisplayName: unauthenticated.");
    return { ok: false, error: "unauthenticated" };
  }

  const trimmed = newDisplayName.trim() || null;

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("users")
    .update({ display_name: trimmed })
    .eq("id", user.id);

  if (error) {
    console.error("updateOwnDisplayName: update failed.", {
      userId: user.id,
      errorMessage: error.message
    });
    return { ok: false, error: error.message };
  }

  console.info("updateOwnDisplayName: success.", { userId: user.id, trimmed });
  return { ok: true };
}

const SELF_DELETE_CONFIRM_WORD = "アカウントを削除します";

/**
 * Phase S-8: Physically deletes the authenticated user's app account.
 *
 * Deletion order:
 *   1. Fetch display_name / membership_status for audit snapshot
 *   2. INSERT account_deletion_logs (snapshot preserved even after auth.users is gone)
 *   3. supabase.auth.admin.deleteUser(user.id)
 *      → CASCADE: public.users → program_enrollments, workout_sessions,
 *                 workout_session_exercises, workout_sets, user_exercises,
 *                 t1_progression_states
 *      → SET NULL: account_deletion_requests.user_id / reviewed_by,
 *                  membership_pause_requests.user_id / reviewed_by,
 *                  billing_cutoff_records.confirmed_by,
 *                  account_deletion_logs.user_id,
 *                  gym_consultation_requests.user_id,
 *                  gym_announcements.created_by
 *
 * What this does NOT change:
 *   - membership_status: gym membership is managed separately from app accounts
 *   - cancelled_at: gym cancellation date, unrelated to app deletion
 *
 * After deletion:
 *   - auth.users is gone → same email can be used to register a new account
 *   - account_deletion_logs row is preserved with user_id = null
 *
 * Security:
 *   - confirmText is validated server-side to prevent CSRF-style misuse.
 *   - deleteUser() uses service_role key via admin client (server-side only).
 */
export async function selfDeleteAccount(input: {
  confirmText: string;
  reason?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabasePublicEnv()) {
    return { ok: false, error: "unavailable" };
  }

  if (input.confirmText !== SELF_DELETE_CONFIRM_WORD) {
    console.warn("selfDeleteAccount: confirm text mismatch.");
    return { ok: false, error: "confirm_mismatch" };
  }

  const client = createSupabaseServerClient();
  const {
    data: { user }
  } = await client.auth.getUser();

  if (!user) {
    console.warn("selfDeleteAccount: unauthenticated.");
    return { ok: false, error: "unauthenticated" };
  }

  const admin = createSupabaseAdminClient();

  // Fetch snapshot data for audit log (display_name / membership_status only)
  const { data: userRow } = await admin
    .from("users")
    .select("display_name, membership_status")
    .eq("id", user.id)
    .maybeSingle<{
      display_name: string | null;
      membership_status: string;
    }>();

  const now = new Date().toISOString();

  // Step 1: Insert audit log BEFORE physical deletion.
  //   After deleteUser(), account_deletion_logs.user_id becomes SET NULL
  //   (migration 000037), so the row is preserved as a permanent audit record.
  const { error: logError } = await admin
    .from("account_deletion_logs")
    .insert({
      user_id: user.id,
      email_snapshot: user.email ?? null,
      display_name_snapshot: userRow?.display_name ?? null,
      membership_status_snapshot: userRow?.membership_status ?? null,
      deletion_method: "self_service",
      reason: input.reason?.trim() || null,
      deleted_at: now
    });

  if (logError) {
    console.error("selfDeleteAccount: audit log insert failed.", {
      userId: user.id,
      errorMessage: logError.message
    });
    return { ok: false, error: logError.message };
  }

  // Step 2: Physical deletion of auth.users.
  //   Cascades through all user-owned tables as documented above.
  //   membership_status and cancelled_at are NOT touched — gym membership
  //   is completely separate from app account management.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

  if (deleteError) {
    console.error("selfDeleteAccount: deleteUser failed.", {
      userId: user.id,
      errorMessage: deleteError.message
    });
    return { ok: false, error: deleteError.message };
  }

  console.info("selfDeleteAccount: success (physical deletion).", {
    userId: user.id
  });
  return { ok: true };
}

/**
 * Submits an account deletion request for the authenticated user.
 *
 * - Inserts into account_deletion_requests with status='pending'.
 * - Does NOT modify membership_status, auth.users, or any training data.
 * - Uses server client + RLS INSERT policy (no service_role needed).
 * - Returns error "pending_exists" if a pending request already exists.
 */
export async function submitDeletionRequest(
  reason: string
): Promise<{ ok: boolean; requestId?: string; error?: string }> {
  if (!hasSupabasePublicEnv()) {
    return { ok: false, error: "unavailable" };
  }

  const client = createSupabaseServerClient();
  const {
    data: { user }
  } = await client.auth.getUser();

  if (!user) {
    console.warn("submitDeletionRequest: unauthenticated.");
    return { ok: false, error: "unauthenticated" };
  }

  const { data, error } = await client
    .from("account_deletion_requests")
    .insert({
      user_id: user.id,
      reason: reason.trim() || null
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      console.warn("submitDeletionRequest: pending request already exists.", {
        userId: user.id
      });
      return { ok: false, error: "pending_exists" };
    }
    console.error("submitDeletionRequest: insert failed.", {
      userId: user.id,
      errorMessage: error.message
    });
    return { ok: false, error: error.message };
  }

  console.info("submitDeletionRequest: success.", { userId: user.id, requestId: data.id });
  return { ok: true, requestId: data.id };
}

/**
 * Cancels the authenticated user's own pending deletion request.
 * Sets status to 'cancelled_by_user'.
 *
 * Security:
 *   - Identity is verified via auth.getUser().
 *   - Uses admin client because users lack UPDATE RLS on account_deletion_requests.
 *   - Self-guard: UPDATE is scoped to user_id = user.id AND status = 'pending'.
 *     This prevents cancelling others' requests or non-pending requests.
 */
export async function cancelDeletionRequest(
  requestId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabasePublicEnv()) {
    return { ok: false, error: "unavailable" };
  }

  const client = createSupabaseServerClient();
  const {
    data: { user }
  } = await client.auth.getUser();

  if (!user) {
    console.warn("cancelDeletionRequest: unauthenticated.");
    return { ok: false, error: "unauthenticated" };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("account_deletion_requests")
    .update({
      status: "cancelled_by_user",
      updated_at: new Date().toISOString()
    })
    .eq("id", requestId)
    .eq("user_id", user.id)    // self-guard: own requests only
    .eq("status", "pending");  // pending requests only; approved/rejected cannot be cancelled

  if (error) {
    console.error("cancelDeletionRequest: update failed.", {
      userId: user.id,
      requestId,
      errorMessage: error.message
    });
    return { ok: false, error: error.message };
  }

  console.info("cancelDeletionRequest: success.", { userId: user.id, requestId });
  return { ok: true };
}

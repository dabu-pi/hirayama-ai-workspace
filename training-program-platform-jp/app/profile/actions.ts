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
 * Immediately soft-deletes the authenticated user's app account.
 *
 * What this does:
 *   - Sets public.users.app_deleted_at = now()
 *   - Anonymises display_name and member_name (set to null)
 *   - Inserts a row into account_deletion_logs for audit
 *
 * What this does NOT do:
 *   - Does NOT delete auth.users
 *   - Does NOT change membership_status (gym membership is managed separately)
 *   - Does NOT change cancelled_at
 *   - Does NOT delete workout_sessions, program_enrollments, or any training data
 *
 * Security:
 *   - confirmText is validated server-side to prevent CSRF-style misuse.
 *   - admin client UPDATE is scoped to WHERE id = user.id (self-guard).
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

  // Fetch current row before any mutation (snapshot for audit log)
  const { data: userRow } = await admin
    .from("users")
    .select("display_name, member_name, membership_status, app_deleted_at")
    .eq("id", user.id)
    .maybeSingle<{
      display_name: string | null;
      member_name: string | null;
      membership_status: string;
      app_deleted_at: string | null;
    }>();

  // Guard: prevent double-execution
  if (userRow?.app_deleted_at) {
    console.warn("selfDeleteAccount: already deleted.", { userId: user.id });
    return { ok: false, error: "already_deleted" };
  }

  const now = new Date().toISOString();

  // 1. Insert audit log BEFORE mutating the user row so the snapshot is accurate.
  //    account_deletion_logs columns: user_id, email_snapshot, display_name_snapshot,
  //    membership_status_snapshot, deletion_method, reason, deleted_at
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

  // 2. Soft-delete + anonymise: set app_deleted_at and clear display fields.
  //    membership_status, cancelled_at, role are intentionally NOT touched.
  const { error: updateError } = await admin
    .from("users")
    .update({
      app_deleted_at: now,
      display_name: null,
      member_name: null
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("selfDeleteAccount: user update failed.", {
      userId: user.id,
      errorMessage: updateError.message
    });
    return { ok: false, error: updateError.message };
  }

  console.info("selfDeleteAccount: success.", { userId: user.id });
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

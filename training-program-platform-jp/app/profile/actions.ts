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

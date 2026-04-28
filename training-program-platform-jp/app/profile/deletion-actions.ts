"use server";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";

export type DeletionRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled_by_user";

export type OwnDeletionRequest = {
  id: string;
  status: DeletionRequestStatus;
  requested_at: string;
  reason: string | null;
};

/**
 * Returns the user's own pending deletion request, or null if none.
 */
export async function getOwnPendingDeletionRequest(): Promise<OwnDeletionRequest | null> {
  if (!hasSupabasePublicEnv()) return null;

  const client = createSupabaseServerClient();
  const {
    data: { user }
  } = await client.auth.getUser();
  if (!user) return null;

  const { data } = await client
    .from("account_deletion_requests")
    .select("id, status, requested_at, reason")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle<OwnDeletionRequest>();

  return data ?? null;
}

/**
 * Submits a new account deletion request for the authenticated user.
 * Fails if the user is already cancelled or a pending request already exists.
 */
export async function submitDeletionRequest(
  reason: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabasePublicEnv()) return { ok: false, error: "unavailable" };

  const client = createSupabaseServerClient();
  const {
    data: { user }
  } = await client.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  // D-1d: Guard — already cancelled users must not create new requests.
  const { data: userRow } = await client
    .from("users")
    .select("membership_status")
    .eq("id", user.id)
    .maybeSingle<{ membership_status: string | null }>();

  if (userRow?.membership_status === "cancelled") {
    return { ok: false, error: "already_cancelled" };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("account_deletion_requests").insert({
    user_id: user.id,
    reason: reason?.trim() || null,
    status: "pending",
  });

  if (error) {
    // Unique constraint violation → pending request already exists
    if (error.code === "23505") {
      return { ok: false, error: "already_pending" };
    }
    console.error("submitDeletionRequest: insert failed.", {
      userId: user.id,
      errorMessage: error.message,
    });
    return { ok: false, error: error.message };
  }

  console.info("submitDeletionRequest: success.", { userId: user.id });
  return { ok: true };
}

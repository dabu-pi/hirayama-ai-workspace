"use server";

import {
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
 * Kept for potential future use; currently not called from ProfileScreen.
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
 * App-based cancellation requests are DISABLED.
 * Cancellation is handled at the reception desk only.
 *
 * To re-enable: remove the early return and restore billing snapshot logic
 * (see git history for Phase M-C implementation).
 */
export async function submitDeletionRequest(
  _reason: string | null
): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: "reception_only" };
}

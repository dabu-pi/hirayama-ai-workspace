"use server";

import {
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";

export type PauseRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled_by_user";

export type OwnPauseRequest = {
  id: string;
  status: PauseRequestStatus;
  requested_at: string;
  reason: string | null;
  next_month_billing_confirmed: boolean;
  effective_from: string | null;
};

/**
 * Returns the user's own pending pause request, or null if none.
 * Kept for potential future use; currently not called from ProfileScreen.
 */
export async function getOwnPendingPauseRequest(): Promise<OwnPauseRequest | null> {
  if (!hasSupabasePublicEnv()) return null;

  const client = createSupabaseServerClient();
  const {
    data: { user }
  } = await client.auth.getUser();
  if (!user) return null;

  const { data } = await client
    .from("membership_pause_requests")
    .select("id, status, requested_at, reason, next_month_billing_confirmed, effective_from")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle<OwnPauseRequest>();

  return data ?? null;
}

/**
 * App-based pause requests are DISABLED.
 * Pause is handled at the reception desk only.
 *
 * To re-enable: remove the early return and restore billing snapshot logic
 * (see git history for Phase M-B implementation).
 */
export async function submitPauseRequest(
  _reason: string | null
): Promise<{ ok: boolean; error?: string; billingMessage?: string }> {
  return { ok: false, error: "reception_only" };
}

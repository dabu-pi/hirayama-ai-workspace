"use server";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";
import { isNextMonthBillingConfirmed, nextMonthFirstDay, formatBillingMonth } from "@/lib/admin/billing";

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

export async function submitPauseRequest(
  reason: string | null
): Promise<{ ok: boolean; error?: string; billingMessage?: string }> {
  if (!hasSupabasePublicEnv()) return { ok: false, error: "unavailable" };

  const client = createSupabaseServerClient();
  const {
    data: { user }
  } = await client.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: userRow } = await client
    .from("users")
    .select("membership_status")
    .eq("id", user.id)
    .maybeSingle<{ membership_status: string | null }>();

  if (userRow?.membership_status === "cancelled") {
    return { ok: false, error: "already_cancelled" };
  }
  if (userRow?.membership_status === "paused") {
    return { ok: false, error: "already_paused" };
  }

  const confirmed = await isNextMonthBillingConfirmed();
  const nextMonth = nextMonthFirstDay();
  const nextMonthLabel = formatBillingMonth(nextMonth);

  // Effective from: 翌月1日 (未確定) or 翌々月1日 (確定済)
  const effectiveDate = new Date(nextMonth);
  if (confirmed) effectiveDate.setMonth(effectiveDate.getMonth() + 1);
  const effectiveFrom = effectiveDate.toISOString().slice(0, 10);

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("membership_pause_requests").insert({
    user_id: user.id,
    reason: reason?.trim() || null,
    status: "pending",
    next_month_billing_confirmed: confirmed,
    effective_from: effectiveFrom
  });

  if (error) {
    if (error.code === "23505") return { ok: false, error: "already_pending" };
    console.error("submitPauseRequest: insert failed.", { userId: user.id, errorMessage: error.message });
    return { ok: false, error: error.message };
  }

  const billingMessage = confirmed
    ? `${nextMonthLabel}分の会費はすでに引き落とし済みのため、翌々月1日より休会となります。引き落とし済み分は再開月に充当されます。`
    : `翌月（${nextMonthLabel}）1日より休会となります。`;

  console.info("submitPauseRequest: success.", { userId: user.id, confirmed, effectiveFrom });
  return { ok: true, billingMessage };
}

"use server";

import { revalidatePath } from "next/cache";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient
} from "@/lib/supabase/server";

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

export async function approvePauseRequest(
  requestId: string,
  adminNote: string
): Promise<{ ok: boolean; error?: string }> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();

  // Fetch request to get user_id, effective_from, next_month_billing_confirmed
  const { data: req, error: fetchErr } = await admin
    .from("membership_pause_requests")
    .select("user_id, effective_from, next_month_billing_confirmed")
    .eq("id", requestId)
    .eq("status", "pending")
    .maybeSingle<{
      user_id: string;
      effective_from: string | null;
      next_month_billing_confirmed: boolean;
    }>();

  if (fetchErr || !req) {
    return { ok: false, error: fetchErr?.message ?? "request_not_found" };
  }

  const now = new Date().toISOString();

  // Update request status
  const { error: reqErr } = await admin
    .from("membership_pause_requests")
    .update({
      status: "approved",
      reviewed_at: now,
      reviewed_by: adminUserId,
      admin_note: adminNote.trim() || null
    })
    .eq("id", requestId);

  if (reqErr) {
    console.error("approvePauseRequest: request update failed.", reqErr.message);
    return { ok: false, error: reqErr.message };
  }

  // Update users: membership_status='paused', paused_at, prepaid_month_credit
  const { error: userErr } = await admin
    .from("users")
    .update({
      membership_status: "paused",
      paused_at: now,
      prepaid_month_credit: req.next_month_billing_confirmed
    })
    .eq("id", req.user_id);

  if (userErr) {
    console.error("approvePauseRequest: user update failed.", userErr.message);
    return { ok: false, error: userErr.message };
  }

  console.info("approvePauseRequest: success.", { requestId, userId: req.user_id });
  revalidatePath("/admin/pause-requests");
  revalidatePath("/admin/members");
  return { ok: true };
}

export async function rejectPauseRequest(
  requestId: string,
  adminNote: string
): Promise<{ ok: boolean; error?: string }> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("membership_pause_requests")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
      admin_note: adminNote.trim() || null
    })
    .eq("id", requestId);

  if (error) {
    console.error("rejectPauseRequest: update failed.", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/pause-requests");
  return { ok: true };
}

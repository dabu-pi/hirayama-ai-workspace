"use server";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

/** Returns the authenticated user's ID only when their role is 'admin'. */
async function requireAdminUserId(): Promise<string | null> {
  const client = createSupabaseServerClient();
  const {
    data: { user },
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
 * Approves a deletion request:
 * - Sets request status = 'approved', reviewed_at/by, admin_note
 * - Sets public.users.membership_status = 'cancelled'
 * Does NOT delete auth.users, workout_sessions, enrollments, or any data.
 */
export async function approveDeletionRequest(
  requestId: string,
  targetUserId: string,
  adminNote: string
): Promise<{ ok: boolean; error?: string }> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  // Update request status
  const { error: reqError } = await admin
    .from("account_deletion_requests")
    .update({
      status: "approved",
      reviewed_at: now,
      reviewed_by: adminUserId,
      admin_note: adminNote.trim() || null,
      updated_at: now,
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (reqError) {
    console.error("approveDeletionRequest: request update failed.", {
      requestId, errorMessage: reqError.message,
    });
    return { ok: false, error: reqError.message };
  }

  // Set membership_status = cancelled + record cancelled_at (safe — no data deleted)
  const { error: userError } = await admin
    .from("users")
    .update({ membership_status: "cancelled", cancelled_at: now })
    .eq("id", targetUserId);

  if (userError) {
    console.error("approveDeletionRequest: membership update failed.", {
      targetUserId, errorMessage: userError.message,
    });
    return { ok: false, error: userError.message };
  }

  console.info("approveDeletionRequest: success.", {
    adminUserId, requestId, targetUserId,
  });
  return { ok: true };
}

/** Records the gym key as returned (sets key_returned_at to now). */
export async function recordKeyReturned(
  requestId: string
): Promise<{ ok: boolean; error?: string }> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("account_deletion_requests")
    .update({ key_returned_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) {
    console.error("recordKeyReturned: failed.", { requestId, errorMessage: error.message });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Records the 500-yen refund as paid (sets refund_500_paid_at to now). */
export async function recordRefund500Paid(
  requestId: string
): Promise<{ ok: boolean; error?: string }> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("account_deletion_requests")
    .update({ refund_500_paid_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) {
    console.error("recordRefund500Paid: failed.", { requestId, errorMessage: error.message });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Rejects a deletion request.
 * membership_status is NOT changed.
 */
export async function rejectDeletionRequest(
  requestId: string,
  adminNote: string
): Promise<{ ok: boolean; error?: string }> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { error } = await admin
    .from("account_deletion_requests")
    .update({
      status: "rejected",
      reviewed_at: now,
      reviewed_by: adminUserId,
      admin_note: adminNote.trim() || null,
      updated_at: now,
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) {
    console.error("rejectDeletionRequest: failed.", {
      requestId, errorMessage: error.message,
    });
    return { ok: false, error: error.message };
  }

  console.info("rejectDeletionRequest: success.", { adminUserId, requestId });
  return { ok: true };
}

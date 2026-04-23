"use server";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient
} from "@/lib/supabase/server";
import type { MembershipStatus } from "@/lib/admin/members";

const VALID_STATUSES: MembershipStatus[] = ["active", "paused", "cancelled"];

/** Returns the authenticated user's ID only when their role is 'admin'. */
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

export async function updateMembershipStatus(
  targetUserId: string,
  newStatus: MembershipStatus
): Promise<{ ok: boolean; error?: string }> {
  // Admin re-check inside the action — UI check alone is not sufficient.
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) {
    console.warn("updateMembershipStatus: rejected — not admin.", { targetUserId });
    return { ok: false, error: "forbidden" };
  }

  // Self-update guard — prevents an admin from locking themselves out.
  if (adminUserId === targetUserId) {
    console.warn("updateMembershipStatus: rejected — self-update.", { adminUserId });
    return { ok: false, error: "self_update_forbidden" };
  }

  if (!VALID_STATUSES.includes(newStatus)) {
    return { ok: false, error: "invalid_status" };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("users")
    .update({ membership_status: newStatus })
    .eq("id", targetUserId);

  if (error) {
    console.error("updateMembershipStatus: update failed.", {
      adminUserId,
      targetUserId,
      newStatus,
      errorMessage: error.message
    });
    return { ok: false, error: error.message };
  }

  console.info("updateMembershipStatus: success.", { adminUserId, targetUserId, newStatus });
  return { ok: true };
}

export async function updateDisplayName(
  targetUserId: string,
  newDisplayName: string
): Promise<{ ok: boolean; error?: string }> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) {
    console.warn("updateDisplayName: rejected — not admin.", { targetUserId });
    return { ok: false, error: "forbidden" };
  }

  // Store trimmed value; empty string → null so "（未設定）" is shown again.
  const trimmed = newDisplayName.trim() || null;

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("users")
    .update({ display_name: trimmed })
    .eq("id", targetUserId);

  if (error) {
    console.error("updateDisplayName: update failed.", { adminUserId, targetUserId, errorMessage: error.message });
    return { ok: false, error: error.message };
  }

  console.info("updateDisplayName: success.", { adminUserId, targetUserId, trimmed });
  return { ok: true };
}

export async function updateMemberName(
  targetUserId: string,
  newMemberName: string
): Promise<{ ok: boolean; error?: string }> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) {
    console.warn("updateMemberName: rejected — not admin.", { targetUserId });
    return { ok: false, error: "forbidden" };
  }

  // Store trimmed value; empty string → null so "（未設定）" is shown again.
  const trimmed = newMemberName.trim() || null;

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("users")
    .update({ member_name: trimmed })
    .eq("id", targetUserId);

  if (error) {
    console.error("updateMemberName: update failed.", { adminUserId, targetUserId, errorMessage: error.message });
    return { ok: false, error: error.message };
  }

  console.info("updateMemberName: success.", { adminUserId, targetUserId, trimmed });
  return { ok: true };
}

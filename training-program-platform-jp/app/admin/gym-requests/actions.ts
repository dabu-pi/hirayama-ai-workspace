"use server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import type { RequestStatus } from "@/lib/gym/consultation-types";

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

export async function updateConsultationRequest(
  id: string,
  status: RequestStatus,
  adminNote: string
): Promise<{ ok: boolean; error?: string }> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("gym_consultation_requests")
    .update({ status, admin_note: adminNote.trim() })
    .eq("id", id);

  if (error) {
    console.error("updateConsultationRequest: update failed.", { id, error: error.message });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteConsultationRequest(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("gym_consultation_requests")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("deleteConsultationRequest: delete failed.", { id, error: error.message });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

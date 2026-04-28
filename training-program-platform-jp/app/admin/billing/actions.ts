"use server";

import { revalidatePath } from "next/cache";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient
} from "@/lib/supabase/server";
import { nextMonthFirstDay } from "@/lib/admin/billing";

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

export async function confirmNextMonthBilling(
  note: string
): Promise<{ ok: boolean; error?: string; alreadyExists?: boolean }> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("billing_cutoff_records").insert({
    billing_month: nextMonthFirstDay(),
    confirmed_by: adminUserId,
    note: note.trim() || null
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, alreadyExists: true, error: "already_confirmed" };
    }
    console.error("confirmNextMonthBilling: failed", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/billing");
  return { ok: true };
}

export async function deleteBillingCutoff(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("billing_cutoff_records")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("deleteBillingCutoff: failed", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/billing");
  return { ok: true };
}

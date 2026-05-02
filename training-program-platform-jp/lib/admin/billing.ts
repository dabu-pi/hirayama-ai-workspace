import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type BillingCutoffRecord = {
  id: string;
  billing_month: string; // "YYYY-MM-DD"
  confirmed_at: string;
  confirmed_by: string | null;
  note: string | null;
};

/** Returns the first day of next month as "YYYY-MM-DD" (JST). */
export function nextMonthFirstDay(): string {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
  );
  const nextMonth = now.getMonth() + 2; // getMonth() is 0-indexed, +2 = next month 1-indexed
  const year = nextMonth > 12 ? now.getFullYear() + 1 : now.getFullYear();
  const month = nextMonth > 12 ? 1 : nextMonth;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/** Formats "YYYY-MM-DD" as "YYYY年MM月" for display. */
export function formatBillingMonth(dateStr: string): string {
  const [y, m] = dateStr.split("-");
  return `${y}年${Number(m)}月`;
}

/** True when billing data for next month has already been confirmed. */
export async function isNextMonthBillingConfirmed(): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("billing_cutoff_records")
    .select("id")
    .eq("billing_month", nextMonthFirstDay())
    .maybeSingle();
  return data !== null;
}

/** Returns all cutoff records, newest first (up to 24 months). */
export async function getBillingCutoffHistory(): Promise<BillingCutoffRecord[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("billing_cutoff_records")
    .select("id, billing_month, confirmed_at, confirmed_by, note")
    .order("billing_month", { ascending: false })
    .limit(24);
  if (error) {
    console.error("getBillingCutoffHistory: query failed", error.message);
    return [];
  }
  return (data ?? []) as BillingCutoffRecord[];
}

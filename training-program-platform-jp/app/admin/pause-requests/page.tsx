import { redirect } from "next/navigation";

import { PauseRequestsScreen } from "@/components/admin/PauseRequestsScreen";
import { getCurrentUserRole } from "@/lib/admin/members";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "休会申請管理"
};

type PauseRequestRow = {
  id: string;
  user_id: string;
  reason: string | null;
  status: string;
  next_month_billing_confirmed: boolean;
  effective_from: string | null;
  requested_at: string;
  reviewed_at: string | null;
  admin_note: string | null;
};

type UserRow = {
  id: string;
  member_name: string | null;
  display_name: string | null;
  membership_status: string;
};

export default async function PauseRequestsPage() {
  const userContext = await getCurrentUserRole();
  if (!userContext) redirect("/login");
  if (userContext.role !== "admin") redirect("/");

  const admin = createSupabaseAdminClient();

  const { data: rawRequests, error } = await admin
    .from("membership_pause_requests")
    .select("id, user_id, reason, status, next_month_billing_confirmed, effective_from, requested_at, reviewed_at, admin_note")
    .order("requested_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("PauseRequestsPage: query failed.", error.message);
  }

  const requests = (rawRequests ?? []) as PauseRequestRow[];

  if (requests.length === 0) {
    return <PauseRequestsScreen requests={[]} />;
  }

  const userIds = Array.from(new Set(requests.map((r) => r.user_id)));
  const [usersResult, authResult] = await Promise.all([
    admin.from("users").select("id, member_name, display_name, membership_status").in("id", userIds),
    admin.auth.admin.listUsers({ perPage: 1000 })
  ]);

  const usersMap = new Map<string, UserRow>();
  for (const u of (usersResult.data ?? []) as UserRow[]) {
    usersMap.set(u.id, u);
  }
  const emailMap = new Map<string, string | null>();
  for (const u of authResult.data?.users ?? []) {
    emailMap.set(u.id, u.email ?? null);
  }

  const enriched = requests.map((r) => {
    const u = usersMap.get(r.user_id);
    return {
      id: r.id,
      userId: r.user_id,
      reason: r.reason,
      status: r.status,
      nextMonthBillingConfirmed: r.next_month_billing_confirmed,
      effectiveFrom: r.effective_from,
      requestedAt: r.requested_at,
      reviewedAt: r.reviewed_at,
      adminNote: r.admin_note,
      email: emailMap.get(r.user_id) ?? null,
      memberName: u?.member_name ?? null,
      displayName: u?.display_name ?? null,
      membershipStatus: u?.membership_status ?? "unknown"
    };
  });

  return <PauseRequestsScreen requests={enriched} />;
}

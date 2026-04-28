import { redirect } from "next/navigation";

import { DeletionRequestsScreen } from "@/components/admin/DeletionRequestsScreen";
import { getCurrentUserRole } from "@/lib/admin/members";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "退会申請管理"
};

type RequestRow = {
  id: string;
  user_id: string;
  reason: string | null;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  admin_note: string | null;
  effective_date: string | null;
  next_month_billing_confirmed: boolean | null;
  key_returned_at: string | null;
  refund_500_paid_at: string | null;
};

type UserRow = {
  id: string;
  member_name: string | null;
  display_name: string | null;
  membership_status: string;
};

export default async function AccountDeletionRequestsPage() {
  const userContext = await getCurrentUserRole();
  if (!userContext) redirect("/login");
  if (userContext.role !== "admin") redirect("/");

  const admin = createSupabaseAdminClient();

  // Fetch requests without embedded join (email lives in auth.users, not public.users)
  const { data: rawRequests, error } = await admin
    .from("account_deletion_requests")
    .select("id, user_id, reason, status, requested_at, reviewed_at, admin_note, effective_date, next_month_billing_confirmed, key_returned_at, refund_500_paid_at")
    .order("requested_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("AccountDeletionRequestsPage: requests query failed.", {
      errorMessage: error.message,
    });
  }

  const requests = (rawRequests ?? []) as RequestRow[];

  if (requests.length === 0) {
    return <DeletionRequestsScreen requests={[]} />;
  }

  // Fetch public.users data + auth.users email in parallel
  const userIds = Array.from(new Set(requests.map((r) => r.user_id)));

  const [usersResult, authResult] = await Promise.all([
    admin
      .from("users")
      .select("id, member_name, display_name, membership_status")
      .in("id", userIds),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  // Build lookups
  const usersMap = new Map<string, UserRow>();
  for (const u of (usersResult.data ?? []) as UserRow[]) {
    usersMap.set(u.id, u);
  }

  const emailMap = new Map<string, string | null>();
  for (const u of authResult.data?.users ?? []) {
    emailMap.set(u.id, u.email ?? null);
  }

  // Merge
  const enriched = requests.map((r) => {
    const u = usersMap.get(r.user_id);
    return {
      id: r.id,
      userId: r.user_id,
      reason: r.reason,
      status: r.status,
      requestedAt: r.requested_at,
      reviewedAt: r.reviewed_at,
      adminNote: r.admin_note,
      email: emailMap.get(r.user_id) ?? null,
      memberName: u?.member_name ?? null,
      displayName: u?.display_name ?? null,
      membershipStatus: u?.membership_status ?? "unknown",
      effectiveDate: r.effective_date,
      nextMonthBillingConfirmed: r.next_month_billing_confirmed,
      keyReturnedAt: r.key_returned_at,
      refund500PaidAt: r.refund_500_paid_at,
    };
  });

  return <DeletionRequestsScreen requests={enriched} />;
}

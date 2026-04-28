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
  users: {
    email: string | null;
    member_name: string | null;
    display_name: string | null;
    membership_status: string;
  } | null;
};

export default async function AccountDeletionRequestsPage() {
  const userContext = await getCurrentUserRole();
  if (!userContext) redirect("/login");
  if (userContext.role !== "admin") redirect("/");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("account_deletion_requests")
    .select(`
      id, user_id, reason, status, requested_at, reviewed_at, admin_note,
      users ( email, member_name, display_name, membership_status )
    `)
    .order("requested_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("AccountDeletionRequestsPage: fetch failed.", {
      errorMessage: error.message,
    });
  }

  const requests = ((data ?? []) as unknown as RequestRow[]).map((r) => ({
    id: r.id,
    userId: r.user_id,
    reason: r.reason,
    status: r.status,
    requestedAt: r.requested_at,
    reviewedAt: r.reviewed_at,
    adminNote: r.admin_note,
    email: r.users?.email ?? null,
    memberName: r.users?.member_name ?? null,
    displayName: r.users?.display_name ?? null,
    membershipStatus: r.users?.membership_status ?? "unknown",
  }));

  return <DeletionRequestsScreen requests={requests} />;
}

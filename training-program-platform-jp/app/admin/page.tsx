import { redirect } from "next/navigation";

import { AdminHubScreen } from "@/components/admin/AdminHubScreen";
import { getCurrentUserRole } from "@/lib/admin/members";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "管理メニュー"
};

export default async function AdminHubPage() {
  const userContext = await getCurrentUserRole();

  if (!userContext) redirect("/login");
  if (userContext.role !== "admin") redirect("/");

  return <AdminHubScreen />;
}

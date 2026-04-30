import { redirect } from "next/navigation";

import { AdminProgramListScreen } from "@/components/admin/AdminProgramListScreen";
import { getCurrentUserRole } from "@/lib/admin/members";
import { getAdminProgramList } from "@/lib/admin/programs";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "プログラム管理"
};

export default async function AdminProgramsPage() {
  const userContext = await getCurrentUserRole();
  if (!userContext) redirect("/login");
  if (userContext.role !== "admin") redirect("/");

  const programs = await getAdminProgramList();

  return <AdminProgramListScreen programs={programs} />;
}

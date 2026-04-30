import { redirect } from "next/navigation";

import { AdminProgramNewScreen } from "@/components/admin/AdminProgramNewScreen";
import { getCurrentUserRole } from "@/lib/admin/members";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "新規プログラム登録"
};

export default async function AdminProgramNewPage() {
  const userContext = await getCurrentUserRole();
  if (!userContext) redirect("/login");
  if (userContext.role !== "admin") redirect("/");

  return <AdminProgramNewScreen />;
}

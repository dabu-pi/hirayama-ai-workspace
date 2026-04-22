import { redirect } from "next/navigation";

import { MembersScreen } from "@/components/admin/MembersScreen";
import { getAllMembers, getCurrentUserRole } from "@/lib/admin/members";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const role = await getCurrentUserRole();

  if (!role) redirect("/login");
  if (role !== "admin") redirect("/");

  const members = await getAllMembers();

  return <MembersScreen members={members} />;
}

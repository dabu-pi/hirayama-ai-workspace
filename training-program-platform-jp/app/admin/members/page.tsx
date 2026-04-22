import { redirect } from "next/navigation";

import { MembersScreen } from "@/components/admin/MembersScreen";
import { getAllMembers, getCurrentUserRole } from "@/lib/admin/members";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const userContext = await getCurrentUserRole();

  if (!userContext) redirect("/login");
  if (userContext.role !== "admin") redirect("/");

  const members = await getAllMembers();

  return <MembersScreen currentUserId={userContext.userId} members={members} />;
}

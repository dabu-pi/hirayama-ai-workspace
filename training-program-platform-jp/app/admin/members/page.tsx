import { redirect } from "next/navigation";

import { MembersScreen } from "@/components/admin/MembersScreen";
import { getAllMembersData, getCurrentUserRole } from "@/lib/admin/members";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const userContext = await getCurrentUserRole();

  if (!userContext) redirect("/login");
  if (userContext.role !== "admin") redirect("/");

  const { members, globalStats } = await getAllMembersData();

  return (
    <MembersScreen
      currentUserId={userContext.userId}
      globalStats={globalStats}
      members={members}
    />
  );
}

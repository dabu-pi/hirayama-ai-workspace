import { redirect } from "next/navigation";

import { ProgramStatsScreen } from "@/components/admin/ProgramStatsScreen";
import { getCurrentUserRole } from "@/lib/admin/members";
import { getProgramStats } from "@/lib/admin/program-stats";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "プログラム利用状況"
};

export default async function ProgramStatsPage() {
  const userContext = await getCurrentUserRole();
  if (!userContext) redirect("/login");
  if (userContext.role !== "admin") redirect("/");

  const stats = await getProgramStats();

  return <ProgramStatsScreen stats={stats} />;
}

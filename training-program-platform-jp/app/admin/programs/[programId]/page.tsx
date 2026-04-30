import { notFound, redirect } from "next/navigation";

import { AdminProgramDetailScreen } from "@/components/admin/AdminProgramDetailScreen";
import { getCurrentUserRole } from "@/lib/admin/members";
import { getAdminProgramDetail } from "@/lib/admin/program-detail";

export const dynamic = "force-dynamic";

type Props = {
  params: { programId: string };
};

export default async function AdminProgramDetailPage({ params }: Props) {
  const userContext = await getCurrentUserRole();
  if (!userContext) redirect("/login");
  if (userContext.role !== "admin") redirect("/");

  const program = await getAdminProgramDetail(params.programId);
  if (!program) notFound();

  return <AdminProgramDetailScreen program={program} />;
}

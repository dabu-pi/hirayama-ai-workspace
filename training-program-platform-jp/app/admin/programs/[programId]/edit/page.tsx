import { notFound, redirect } from "next/navigation";

import { AdminProgramEditScreen } from "@/components/admin/AdminProgramEditScreen";
import { getCurrentUserRole } from "@/lib/admin/members";
import { getAdminProgramDetail } from "@/lib/admin/program-detail";

export const dynamic = "force-dynamic";

type Props = {
  params: { programId: string };
};

export default async function AdminProgramEditPage({ params }: Props) {
  const userContext = await getCurrentUserRole();
  if (!userContext) redirect("/login");
  if (userContext.role !== "admin") redirect("/");

  const program = await getAdminProgramDetail(params.programId);
  if (!program) notFound();

  return <AdminProgramEditScreen program={program} />;
}

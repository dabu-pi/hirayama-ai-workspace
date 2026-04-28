import { redirect } from "next/navigation";

import { GymRequestsScreen } from "@/components/admin/GymRequestsScreen";
import { getAllConsultationRequests } from "@/lib/gym/consultation-requests";
import { getCurrentUserRole } from "@/lib/admin/members";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "相談申込管理"
};

export default async function AdminGymRequestsPage() {
  const userContext = await getCurrentUserRole();

  if (!userContext) redirect("/login");
  if (userContext.role !== "admin") redirect("/");

  const requests = await getAllConsultationRequests();

  return <GymRequestsScreen requests={requests} />;
}

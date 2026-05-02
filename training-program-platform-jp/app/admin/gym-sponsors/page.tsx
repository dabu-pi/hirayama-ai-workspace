import { redirect } from "next/navigation";

import { GymSponsorsScreen } from "@/components/admin/GymSponsorsScreen";
import { getAllSponsors } from "@/lib/gym/sponsors";
import { getCurrentUserRole } from "@/lib/admin/members";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "スポンサー管理"
};

export default async function AdminGymSponsorsPage() {
  const userContext = await getCurrentUserRole();

  if (!userContext) redirect("/login");
  if (userContext.role !== "admin") redirect("/");

  const sponsors = await getAllSponsors();

  return <GymSponsorsScreen sponsors={sponsors} />;
}

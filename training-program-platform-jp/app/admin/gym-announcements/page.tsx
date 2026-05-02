import { redirect } from "next/navigation";

import { GymAnnouncementsScreen } from "@/components/admin/GymAnnouncementsScreen";
import { getAllAnnouncements } from "@/lib/gym/announcements";
import { getCurrentUserRole } from "@/lib/admin/members";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "お知らせ管理"
};

export default async function AdminGymAnnouncementsPage() {
  const userContext = await getCurrentUserRole();

  if (!userContext) redirect("/login");
  if (userContext.role !== "admin") redirect("/");

  const announcements = await getAllAnnouncements();

  return <GymAnnouncementsScreen announcements={announcements} />;
}

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublishedAnnouncements } from "@/lib/gym/announcements";
import { getPublishedSponsors } from "@/lib/gym/sponsors";
import { getGymDashboardData } from "@/lib/workout/gym-dashboard";
import { getMembershipStatus } from "@/lib/workout/membership";
import { GymScreen } from "@/components/gym/GymScreen";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Gym"
};

export default async function GymPage() {
  const client = createSupabaseServerClient();
  const {
    data: { user }
  } = await client.auth.getUser();

  const [stats, announcements, sponsors, membershipStatus] = await Promise.all([
    user ? getGymDashboardData(user.id) : Promise.resolve(null),
    getPublishedAnnouncements(),
    getPublishedSponsors(),
    user ? getMembershipStatus(user.id) : Promise.resolve(null),
  ]);

  return (
    <GymScreen
      announcements={announcements}
      membershipStatus={membershipStatus}
      sponsors={sponsors}
      stats={stats}
    />
  );
}

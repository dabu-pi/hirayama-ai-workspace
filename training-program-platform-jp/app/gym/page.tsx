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

  // Personal stats require auth. Non-logged-in visitors see the gym
  // info page without personal training statistics.
  const [stats, announcements, sponsors, membershipStatus, pendingPauseRow] = await Promise.all([
    user ? getGymDashboardData(user.id) : Promise.resolve(null),
    getPublishedAnnouncements(),
    getPublishedSponsors(),
    user ? getMembershipStatus(user.id) : Promise.resolve(null),
    user
      ? client
          .from("membership_pause_requests")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .maybeSingle()
      : Promise.resolve({ data: null })
  ]);

  return (
    <GymScreen
      announcements={announcements}
      hasPendingPause={pendingPauseRow.data !== null}
      membershipStatus={membershipStatus}
      sponsors={sponsors}
      stats={stats}
    />
  );
}

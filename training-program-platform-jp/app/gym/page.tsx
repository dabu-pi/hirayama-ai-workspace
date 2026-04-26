import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGymDashboardData } from "@/lib/workout/gym-dashboard";
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
  const stats = user ? await getGymDashboardData(user.id) : null;

  return <GymScreen stats={stats} />;
}

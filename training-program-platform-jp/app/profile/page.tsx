import { redirect } from "next/navigation";

import {
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";
import { ProfileScreen } from "@/components/profile/ProfileScreen";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  if (!hasSupabasePublicEnv()) {
    redirect("/login");
  }

  const client = createSupabaseServerClient();
  const {
    data: { user }
  } = await client.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: userRow } = await client
    .from("users")
    .select("display_name, membership_status")
    .eq("id", user.id)
    .maybeSingle<{ display_name: string | null; membership_status: string | null }>();

  return (
    <ProfileScreen
      email={user.email ?? null}
      initialDisplayName={userRow?.display_name ?? null}
      membershipStatus={userRow?.membership_status ?? null}
    />
  );
}

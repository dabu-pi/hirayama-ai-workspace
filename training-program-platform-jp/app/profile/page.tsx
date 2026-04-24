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

  // Read own public.users row — allowed by "Users can read own profile" RLS policy.
  const { data: userRow } = await client
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle<{ display_name: string | null }>();

  return (
    <ProfileScreen
      email={user.email ?? null}
      initialDisplayName={userRow?.display_name ?? null}
    />
  );
}

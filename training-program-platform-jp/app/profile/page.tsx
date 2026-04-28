import { redirect } from "next/navigation";

import {
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";
import { getOwnPendingDeletionRequest } from "@/app/profile/deletion-actions";
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
  const [userRowResult, pendingDeletionRequest] = await Promise.all([
    client
      .from("users")
      .select("display_name, membership_status")
      .eq("id", user.id)
      .maybeSingle<{ display_name: string | null; membership_status: string | null }>(),
    getOwnPendingDeletionRequest(),
  ]);

  return (
    <ProfileScreen
      email={user.email ?? null}
      initialDisplayName={userRowResult.data?.display_name ?? null}
      membershipStatus={userRowResult.data?.membership_status ?? null}
      pendingDeletionRequest={pendingDeletionRequest}
    />
  );
}

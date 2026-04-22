import "server-only";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient
} from "@/lib/supabase/server";

export type MembershipStatus = "active" | "paused" | "cancelled";

export type MemberRow = {
  id: string;
  display_name: string | null;
  role: string;
  membership_status: MembershipStatus;
  created_at: string;
};

export type CurrentUserContext = {
  userId: string;
  role: string;
};

/**
 * Returns the authenticated user's ID and role using their own RLS-scoped row.
 * Returns null when unauthenticated or when the public.users row is missing.
 */
export async function getCurrentUserRole(): Promise<CurrentUserContext | null> {
  const client = createSupabaseServerClient();
  const {
    data: { user }
  } = await client.auth.getUser();
  if (!user) return null;

  const { data } = await client
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string }>();

  if (!data) return null;
  return { userId: user.id, role: data.role };
}

/**
 * Fetches all users ordered by created_at ascending.
 * Uses service role to bypass RLS — call only after confirming the requester is admin.
 */
export async function getAllMembers(): Promise<MemberRow[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id, display_name, role, membership_status, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getAllMembers: query failed.", error);
    return [];
  }

  return (data ?? []) as MemberRow[];
}

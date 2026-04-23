import "server-only";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient
} from "@/lib/supabase/server";

export type MembershipStatus = "active" | "paused" | "cancelled";

export type MemberRow = {
  id: string;
  member_name: string | null;
  display_name: string | null;
  email: string | null;
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
 * Fetches all users ordered by created_at ascending, with email merged from auth.users.
 * Uses service role to bypass RLS — call only after confirming the requester is admin.
 * auth.admin.listUsers uses perPage:1000 — sufficient for small-scale admin use.
 */
export async function getAllMembers(): Promise<MemberRow[]> {
  const admin = createSupabaseAdminClient();

  const [usersResult, authResult] = await Promise.all([
    admin
      .from("users")
      .select("id, member_name, display_name, role, membership_status, created_at")
      .order("created_at", { ascending: true }),
    admin.auth.admin.listUsers({ perPage: 1000 })
  ]);

  if (usersResult.error) {
    console.error("getAllMembers: users query failed.", usersResult.error);
    return [];
  }

  // Build email lookup from auth.users
  const emailMap: Record<string, string> = {};
  for (const u of authResult.data?.users ?? []) {
    if (u.email) emailMap[u.id] = u.email;
  }

  return (usersResult.data ?? []).map((row) => ({
    ...(row as Omit<MemberRow, "email">),
    email: emailMap[row.id] ?? null
  }));
}

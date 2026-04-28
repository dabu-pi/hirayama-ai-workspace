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
  last_sign_in_at: string | null;
  training_started_count: number;
  training_completed_count: number;
  last_training_at: string | null;
  has_active_enrollment: boolean;
};

export type AdminGlobalStats = {
  total_members: number;
  active_count: number;
  paused_count: number;
  cancelled_count: number;
  completed_sessions_last30d: number;
  inactive_active_members_last30d: number;
};

export type AdminMembersData = {
  members: MemberRow[];
  globalStats: AdminGlobalStats;
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
 * Fetches all members with per-user usage stats and global summary in one pass.
 * Uses service role to bypass RLS — call only after confirming the requester is admin.
 *
 * Session aggregation is done in memory (suitable for small-scale admin use).
 * If member count grows, replace with a DB view or RPC function.
 */
export async function getAllMembersData(): Promise<AdminMembersData> {
  const admin = createSupabaseAdminClient();

  const [usersResult, authResult, sessionsResult, enrollmentsResult] =
    await Promise.all([
      admin
        .from("users")
        .select("id, member_name, display_name, role, membership_status, created_at")
        .order("created_at", { ascending: true }),
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin
        .from("workout_sessions")
        .select("user_id, status, started_at"),
      admin
        .from("program_enrollments")
        .select("user_id")
        .eq("status", "active")
    ]);

  if (usersResult.error) {
    console.error("getAllMembersData: users query failed.", usersResult.error);
    return {
      members: [],
      globalStats: {
        total_members: 0,
        active_count: 0,
        paused_count: 0,
        cancelled_count: 0,
        completed_sessions_last30d: 0,
        inactive_active_members_last30d: 0
      }
    };
  }

  // Build lookup: auth user id → { email, last_sign_in_at }
  const authMap: Record<string, { email: string | null; last_sign_in_at: string | null }> =
    {};
  for (const u of authResult.data?.users ?? []) {
    authMap[u.id] = {
      email: u.email ?? null,
      last_sign_in_at: u.last_sign_in_at ?? null
    };
  }

  // Aggregate session stats per user
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  type SessionAgg = { started: number; completed: number; lastAt: string | null };
  const sessionAgg: Record<string, SessionAgg> = {};
  let completedLast30d = 0;

  for (const s of sessionsResult.data ?? []) {
    if (!sessionAgg[s.user_id]) {
      sessionAgg[s.user_id] = { started: 0, completed: 0, lastAt: null };
    }
    sessionAgg[s.user_id].started++;
    if (s.status === "completed") {
      sessionAgg[s.user_id].completed++;
      if (s.started_at >= thirtyDaysAgo) completedLast30d++;
    }
    if (
      !sessionAgg[s.user_id].lastAt ||
      s.started_at > sessionAgg[s.user_id].lastAt!
    ) {
      sessionAgg[s.user_id].lastAt = s.started_at;
    }
  }

  // Build active enrollment set
  const activeEnrollmentSet = new Set(
    (enrollmentsResult.data ?? []).map((e) => e.user_id)
  );

  // Build member rows
  type UserRow = {
    id: string;
    member_name: string | null;
    display_name: string | null;
    role: string;
    membership_status: MembershipStatus;
    created_at: string;
  };

  const members: MemberRow[] = (usersResult.data as UserRow[]).map((row) => {
    const agg = sessionAgg[row.id] ?? { started: 0, completed: 0, lastAt: null };
    return {
      ...row,
      email: authMap[row.id]?.email ?? null,
      last_sign_in_at: authMap[row.id]?.last_sign_in_at ?? null,
      training_started_count: agg.started,
      training_completed_count: agg.completed,
      last_training_at: agg.lastAt,
      has_active_enrollment: activeEnrollmentSet.has(row.id)
    };
  });

  // Global stats (derived from member rows — no extra queries)
  const statusCounts = { active: 0, paused: 0, cancelled: 0 };
  let inactiveLast30d = 0;

  for (const m of members) {
    statusCounts[m.membership_status]++;
    if (m.membership_status === "active") {
      const isInactive =
        !m.last_training_at || m.last_training_at < thirtyDaysAgo;
      if (isInactive) inactiveLast30d++;
    }
  }

  const globalStats: AdminGlobalStats = {
    total_members: members.length,
    active_count: statusCounts.active,
    paused_count: statusCounts.paused,
    cancelled_count: statusCounts.cancelled,
    completed_sessions_last30d: completedLast30d,
    inactive_active_members_last30d: inactiveLast30d
  };

  return { members, globalStats };
}

import "server-only";

import {
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";
import { jstDateSlice } from "@/lib/utils/date-jst";

export type GymDashboardStats = {
  monthlyCount: number;
  lastTrainingDate: string | null; // "YYYY-MM-DD" in JST, or null if no sessions
};

/**
 * Returns the current user's monthly completed-session count and
 * the most recent training date, both in JST.
 *
 * Queries workout_sessions using the user's own RLS-scoped client.
 * Only completed, non-archived sessions are counted.
 * DB stores timestamps in UTC; month boundary is computed in JST.
 */
export async function getGymDashboardData(
  userId: string
): Promise<GymDashboardStats> {
  if (!hasSupabasePublicEnv() || !userId) {
    return { monthlyCount: 0, lastTrainingDate: null };
  }

  try {
    const client = createSupabaseServerClient();

    // Compute JST month start and convert to UTC for the DB query.
    // e.g. 2026-04-01T00:00:00+09:00 → 2026-03-31T15:00:00.000Z
    const nowJst = jstDateSlice(new Date().toISOString()); // "YYYY-MM-DD"
    const [year, month] = nowJst.split("-").map(Number);
    const jstMonthStart = new Date(
      `${year}-${String(month).padStart(2, "0")}-01T00:00:00+09:00`
    );
    const utcMonthStart = jstMonthStart.toISOString();

    const { data, error } = await client
      .from("workout_sessions")
      .select("started_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .is("archived_at", null);

    if (error) {
      console.error("getGymDashboardData: query failed.", error.message);
      return { monthlyCount: 0, lastTrainingDate: null };
    }

    const rows = data ?? [];
    let monthlyCount = 0;
    let latestUtc: string | null = null;

    for (const row of rows) {
      if (row.started_at >= utcMonthStart) monthlyCount++;
      if (!latestUtc || row.started_at > latestUtc) latestUtc = row.started_at;
    }

    const lastTrainingDate = latestUtc ? jstDateSlice(latestUtc) : null;

    return { monthlyCount, lastTrainingDate };
  } catch {
    return { monthlyCount: 0, lastTrainingDate: null };
  }
}

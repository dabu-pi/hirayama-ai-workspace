import "server-only";

import { getAuthenticatedWorkoutContext } from "@/lib/workout/session-access";

export type MembershipStatus = "active" | "paused" | "cancelled";

/**
 * Returns the membership_status for the given user.
 * Uses the authenticated client so RLS ("Users can read own profile") applies.
 *
 * Fails open (returns null) on query error to avoid accidentally blocking
 * legitimate users due to transient DB issues.
 */
export async function getMembershipStatus(
  userId: string
): Promise<MembershipStatus | null> {
  const { client } = await getAuthenticatedWorkoutContext();

  const { data, error } = await client
    .from("users")
    .select("membership_status")
    .eq("id", userId)
    .maybeSingle<{ membership_status: MembershipStatus }>();

  if (error) {
    console.warn("getMembershipStatus: query failed — failing open", {
      userId,
      errorMessage: error.message
    });
    return null;
  }

  return data?.membership_status ?? null;
}

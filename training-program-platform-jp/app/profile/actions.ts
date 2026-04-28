"use server";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";

/**
 * Updates the authenticated user's own display_name.
 *
 * Security:
 *   - Identity is verified via auth.getUser() (cookie-based JWT — cannot be spoofed).
 *   - Only display_name is written. member_name, membership_status, email, role
 *     are never touched, even if the caller passes extra data.
 *   - The UPDATE is scoped to WHERE id = user.id so other users' rows are safe.
 */
export async function updateOwnDisplayName(
  newDisplayName: string
): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabasePublicEnv()) {
    return { ok: false, error: "unavailable" };
  }

  const client = createSupabaseServerClient();
  const {
    data: { user }
  } = await client.auth.getUser();

  if (!user) {
    console.warn("updateOwnDisplayName: unauthenticated.");
    return { ok: false, error: "unauthenticated" };
  }

  const trimmed = newDisplayName.trim() || null;

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("users")
    .update({ display_name: trimmed })
    .eq("id", user.id);

  if (error) {
    console.error("updateOwnDisplayName: update failed.", {
      userId: user.id,
      errorMessage: error.message
    });
    return { ok: false, error: error.message };
  }

  console.info("updateOwnDisplayName: success.", { userId: user.id, trimmed });
  return { ok: true };
}

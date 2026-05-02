export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import {
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";
import { getActiveProgramView } from "@/lib/workout/active-program";

/**
 * Home ( / ) はルーターとして機能する。
 * - 未ログイン                                 → /login
 * - ログイン済み + in-progress session あり    → /train  (resume)
 * - ログイン済み + in-progress session なし    → /programs
 *
 * NOTE: previously redirected to /train whenever views.length > 0 (i.e. any
 * active enrollment existed). That caused a Cancel-then-home loop:
 *   Cancel → router.replace("/") → Home → redirect("/train") → StartSessionScreen
 * The fix: only redirect to /train when a session is actively in-progress
 * (actionType === "resume"). When the user just cancelled, actionType becomes
 * "start" and they land on /programs where they can choose to re-start.
 */
export default async function HomePage() {
  const { views, isAuthenticated, hasCustomInProgressSession } = await getActiveProgramView();

  if (!isAuthenticated) {
    redirect("/login");
  }

  // Block soft-deleted users from reaching app content via the home router.
  // This catches re-login after app_deleted_at is set (middleware doesn't cover /).
  if (hasSupabasePublicEnv()) {
    const client = createSupabaseServerClient();
    const {
      data: { user }
    } = await client.auth.getUser();
    if (user) {
      const { data: userRow } = await client
        .from("users")
        .select("app_deleted_at")
        .eq("id", user.id)
        .maybeSingle<{ app_deleted_at: string | null }>();
      if (userRow?.app_deleted_at) {
        redirect("/account-deleted");
      }
    }
  }

  // Only redirect to /train when there is an in-progress session to resume.
  // actionType="start" or "none" lands on /programs — avoids the cancel loop.
  // Also redirect when a custom (program-free) in-progress session exists.
  const hasResumableSession =
    views.some((v) => v.actionType === "resume") ||
    hasCustomInProgressSession === true;
  if (hasResumableSession) {
    redirect("/train");
  }

  redirect("/programs");
}

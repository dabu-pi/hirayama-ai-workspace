export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

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
  const { views, isAuthenticated } = await getActiveProgramView();

  if (!isAuthenticated) {
    redirect("/login");
  }

  // Only redirect to /train when there is an in-progress session to resume.
  // actionType="start" or "none" lands on /programs — avoids the cancel loop.
  const hasResumableSession = views.some((v) => v.actionType === "resume");
  if (hasResumableSession) {
    redirect("/train");
  }

  redirect("/programs");
}

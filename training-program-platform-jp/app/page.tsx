export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { getActiveProgramView } from "@/lib/workout/active-program";

/**
 * Home ( / ) はルーターとして機能する。
 * - 未ログイン                           → /login
 * - ログイン済み + active enrollment あり → /train
 * - ログイン済み + enrollment なし       → /programs
 */
export default async function HomePage() {
  const { views, isAuthenticated } = await getActiveProgramView();

  if (!isAuthenticated) {
    redirect("/login");
  }

  if (views.length > 0) {
    redirect("/train");
  }

  redirect("/programs");
}

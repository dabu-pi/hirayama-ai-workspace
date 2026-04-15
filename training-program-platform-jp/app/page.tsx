export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { getActiveProgramView } from "@/lib/workout/active-program";

/**
 * Home ( / ) はルーターとして機能する。
 * - ログイン済み + active enrollment あり → /train
 * - ログイン済み + enrollment なし       → /programs
 * - 未ログイン                           → /programs（ゲスト向けライブラリ）
 */
export default async function HomePage() {
  const { views, isAuthenticated } = await getActiveProgramView();

  if (isAuthenticated && views.length > 0) {
    redirect("/train");
  }

  redirect("/programs");
}

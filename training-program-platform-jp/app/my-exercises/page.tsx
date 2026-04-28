import { redirect } from "next/navigation";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";
import { MyExercisesScreen } from "@/components/workout/MyExercisesScreen";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "マイ種目"
};

type UserExerciseRow = {
  id: string;
  name: string;
  category: string | null;
  default_unit: string;
  memo: string;
  is_archived: boolean;
  created_at: string;
};

export default async function MyExercisesPage() {
  if (!hasSupabasePublicEnv()) {
    redirect("/login");
  }

  const client = createSupabaseServerClient();
  const {
    data: { user }
  } = await client.auth.getUser();

  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("user_exercises")
    .select("id, name, category, default_unit, memo, is_archived, created_at")
    .eq("user_id", user.id)
    .order("is_archived", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("MyExercisesPage: query failed.", error.message);
  }

  const exercises = ((data ?? []) as UserExerciseRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    defaultUnit: row.default_unit,
    memo: row.memo,
    isArchived: row.is_archived,
    createdAt: row.created_at
  }));

  return <MyExercisesScreen exercises={exercises} />;
}

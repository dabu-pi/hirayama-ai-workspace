export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";

type UserExerciseRow = {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  default_unit: string;
  memo: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

/** GET /api/user-exercises — returns the logged-in user's non-archived exercises. */
export async function GET() {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ exercises: [] });
  }

  const client = createSupabaseServerClient();
  const {
    data: { user }
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "ログインが必要です。" } },
      { status: 401 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("user_exercises")
    .select("id, user_id, name, category, default_unit, memo, is_archived, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GET /api/user-exercises: query failed.", error.message);
    return NextResponse.json(
      { error: { code: "query_failed", message: "種目一覧の取得に失敗しました。" } },
      { status: 500 }
    );
  }

  const exercises = ((data ?? []) as UserExerciseRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    defaultUnit: row.default_unit,
    memo: row.memo,
    createdAt: row.created_at
  }));

  return NextResponse.json({ exercises });
}

/** POST /api/user-exercises — creates a new user exercise. */
export async function POST(request: Request) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json(
      { error: { code: "service_unavailable", message: "Service unavailable." } },
      { status: 503 }
    );
  }

  const client = createSupabaseServerClient();
  const {
    data: { user }
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "ログインが必要です。" } },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    category?: string;
    memo?: string;
  };

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json(
      { error: { code: "name_required", message: "種目名は必須です。" } },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: inserted, error } = await admin
    .from("user_exercises")
    .insert({
      user_id: user.id,
      name,
      category: body.category?.trim() || null,
      memo: body.memo?.trim() ?? ""
    })
    .select("id, name, category, default_unit, memo, created_at")
    .single<{
      id: string;
      name: string;
      category: string | null;
      default_unit: string;
      memo: string;
      created_at: string;
    }>();

  if (error || !inserted) {
    console.error("POST /api/user-exercises: insert failed.", error?.message);
    return NextResponse.json(
      { error: { code: "insert_failed", message: "種目の作成に失敗しました。" } },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      exercise: {
        id: inserted.id,
        name: inserted.name,
        category: inserted.category,
        defaultUnit: inserted.default_unit,
        memo: inserted.memo,
        createdAt: inserted.created_at
      }
    },
    { status: 201 }
  );
}

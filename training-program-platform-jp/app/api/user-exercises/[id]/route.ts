export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";

type RouteContext = {
  params: {
    id: string;
  };
};

/** PATCH /api/user-exercises/[id] — update name/category/memo or toggle is_archived for own exercise. */
export async function PATCH(request: Request, { params }: RouteContext) {
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
    category?: string | null;
    memo?: string;
    is_archived?: boolean;
  };

  const update: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json(
        { error: { code: "name_required", message: "種目名は必須です。" } },
        { status: 400 }
      );
    }
    update.name = name;
  }
  if (body.category !== undefined) {
    update.category = typeof body.category === "string" ? body.category.trim() || null : null;
  }
  if (body.memo !== undefined) update.memo = body.memo.trim();
  if (body.is_archived !== undefined) update.is_archived = body.is_archived;

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: { code: "nothing_to_update", message: "更新するフィールドがありません。" } },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("user_exercises")
    .update(update)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("id, name, category, default_unit, memo, is_archived, updated_at")
    .single<{
      id: string;
      name: string;
      category: string | null;
      default_unit: string;
      memo: string;
      is_archived: boolean;
      updated_at: string;
    }>();

  if (error || !data) {
    console.error("PATCH /api/user-exercises/[id]: update failed.", error?.message);
    return NextResponse.json(
      { error: { code: "update_failed", message: "種目の更新に失敗しました。" } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    exercise: {
      id: data.id,
      name: data.name,
      category: data.category,
      defaultUnit: data.default_unit,
      memo: data.memo,
      isArchived: data.is_archived,
      updatedAt: data.updated_at
    }
  });
}

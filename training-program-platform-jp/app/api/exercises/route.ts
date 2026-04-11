export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasSupabaseServiceRoleEnv
} from "@/lib/supabase/server";

type ExerciseRow = {
  id: string;
  slug: string;
  name_ja: string;
  name_en: string;
  category: string | null;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";

    const supabase = hasSupabaseServiceRoleEnv()
      ? createSupabaseAdminClient()
      : createSupabaseServerClient();

    let query = supabase
      .from("exercises")
      .select("id, slug, name_ja, name_en, category")
      .order("name_ja", { ascending: true })
      .limit(200);

    if (q) {
      query = query.or(`name_ja.ilike.%${q}%,name_en.ilike.%${q}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        {
          error: {
            code: "exercises_lookup_failed",
            message: "Failed to load exercises."
          }
        },
        { status: 500 }
      );
    }

    const exercises = ((data ?? []) as ExerciseRow[]).map((item) => ({
      id: item.id,
      nameJa: item.name_ja,
      nameEn: item.name_en,
      category: item.category
    }));

    return NextResponse.json({ exercises });
  } catch (error) {
    console.error("Failed to load exercises.", error);

    return NextResponse.json(
      {
        error: {
          code: "exercises_unexpected_error",
          message: "Unexpected error occurred while loading exercises."
        }
      },
      { status: 500 }
    );
  }
}

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

type SessionRow = {
  id: string;
  started_at: string;
};

type SessionExerciseRow = {
  id: string;
  exercise_id: string;
  workout_session_id: string;
};

type WorkoutSetRow = {
  workout_session_exercise_id: string;
  set_number: number;
  weight_kg: number | string | null;
  reps_done: number | null;
};

function toNullableNumber(value: number | string | null): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchLastSetPerExercise(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  exerciseIds: string[]
): Promise<Record<string, { lastWeightKg: number | null; lastRepsDone: number | null; lastDate: string }>> {
  if (exerciseIds.length === 0) return {};

  const { data: recentSessions } = await supabase
    .from("workout_sessions")
    .select("id, started_at")
    .eq("user_id", userId)
    .eq("status", "completed")
    .is("archived_at", null)
    .order("started_at", { ascending: false })
    .limit(50);

  if (!recentSessions?.length) return {};

  const typedSessions = recentSessions as SessionRow[];
  const sessionIds = typedSessions.map((s) => s.id);
  const sessionDateMap = new Map(typedSessions.map((s) => [s.id, s.started_at]));

  const { data: sessionExercises } = await supabase
    .from("workout_session_exercises")
    .select("id, exercise_id, workout_session_id")
    .in("workout_session_id", sessionIds)
    .in("exercise_id", exerciseIds);

  if (!sessionExercises?.length) return {};

  const typedSE = sessionExercises as SessionExerciseRow[];

  const latestByExercise = new Map<string, { id: string; sessionDate: string }>();
  for (const se of typedSE) {
    const date = sessionDateMap.get(se.workout_session_id) ?? "";
    const current = latestByExercise.get(se.exercise_id);
    if (!current || date > current.sessionDate) {
      latestByExercise.set(se.exercise_id, { id: se.id, sessionDate: date });
    }
  }

  const seIds = Array.from(latestByExercise.values()).map((v) => v.id);

  const { data: sets } = await supabase
    .from("workout_sets")
    .select("workout_session_exercise_id, set_number, weight_kg, reps_done")
    .in("workout_session_exercise_id", seIds)
    .eq("is_completed", true)
    .is("deleted_at", null)
    .order("set_number", { ascending: true });

  if (!sets?.length) return {};

  const typedSets = sets as WorkoutSetRow[];
  const setsBySeId = new Map<string, WorkoutSetRow[]>();
  for (const s of typedSets) {
    const group = setsBySeId.get(s.workout_session_exercise_id) ?? [];
    group.push(s);
    setsBySeId.set(s.workout_session_exercise_id, group);
  }

  const result: Record<string, { lastWeightKg: number | null; lastRepsDone: number | null; lastDate: string }> = {};

  for (const [exerciseId, { id: seId, sessionDate }] of latestByExercise) {
    const exerciseSets = setsBySeId.get(seId);
    if (!exerciseSets?.length) continue;
    const lastSet = exerciseSets[exerciseSets.length - 1];
    result[exerciseId] = {
      lastWeightKg: toNullableNumber(lastSet.weight_kg),
      lastRepsDone: lastSet.reps_done,
      lastDate: sessionDate.slice(0, 10)
    };
  }

  return result;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const swapGroup = searchParams.get("swap_group")?.trim() ?? "";
    const includeHistory = searchParams.get("include_history") === "true";

    const supabase = hasSupabaseServiceRoleEnv()
      ? createSupabaseAdminClient()
      : createSupabaseServerClient();

    let query = supabase
      .from("exercises")
      .select("id, slug, name_ja, name_en, category")
      .order("name_ja", { ascending: true })
      .limit(200);

    if (swapGroup) {
      const { data: memberRows, error: memberError } = await supabase
        .from("exercise_swap_group_members")
        .select("exercise_id")
        .eq("group_slug", swapGroup);

      if (memberError) {
        return NextResponse.json(
          {
            error: {
              code: "swap_group_lookup_failed",
              message: "Failed to load swap group members."
            }
          },
          { status: 500 }
        );
      }

      const memberIds = ((memberRows ?? []) as { exercise_id: string }[]).map(
        (r) => r.exercise_id
      );

      if (memberIds.length === 0) {
        return NextResponse.json({ exercises: [] });
      }

      query = query.in("id", memberIds);
    }

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

    const exerciseRows = ((data ?? []) as ExerciseRow[]);

    let historyMap: Record<string, { lastWeightKg: number | null; lastRepsDone: number | null; lastDate: string }> = {};

    if (includeHistory && exerciseRows.length > 0) {
      const serverClient = createSupabaseServerClient();
      const { data: userData } = await serverClient.auth.getUser();
      const userId = userData.user?.id ?? null;

      if (userId) {
        historyMap = await fetchLastSetPerExercise(supabase, userId, exerciseRows.map((r) => r.id));
      }
    }

    const libraryExercises = exerciseRows.map((item) => {
      const hist = historyMap[item.id];
      return {
        id: item.id,
        nameJa: item.name_ja,
        nameEn: item.name_en,
        category: item.category,
        source: "library" as const,
        ...(includeHistory
          ? {
              lastWeightKg: hist?.lastWeightKg ?? null,
              lastRepsDone: hist?.lastRepsDone ?? null,
              lastDate: hist?.lastDate ?? null
            }
          : {})
      };
    });

    // Append user's personal exercises when in add-mode (include_history=true means custom session).
    let userExercises: typeof libraryExercises = [];
    if (includeHistory && !swapGroup) {
      const serverClient = createSupabaseServerClient();
      const { data: userData } = await serverClient.auth.getUser();
      const userId = userData.user?.id ?? null;
      if (userId) {
        const { data: ueData } = await supabase
          .from("user_exercises")
          .select("id, name, category")
          .eq("user_id", userId)
          .eq("is_archived", false)
          .order("created_at", { ascending: false })
          .limit(100);
        userExercises = ((ueData ?? []) as { id: string; name: string; category: string | null }[]).map((ue) => ({
          id: ue.id,
          nameJa: ue.name,
          nameEn: ue.name,
          category: ue.category,
          source: "user" as const,
          lastWeightKg: null,
          lastRepsDone: null,
          lastDate: null
        }));
      }
    }

    const exercises = [...libraryExercises, ...userExercises];
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

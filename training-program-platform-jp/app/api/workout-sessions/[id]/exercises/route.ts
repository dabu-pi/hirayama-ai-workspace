import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  findOwnedWorkoutSession,
  getAuthenticatedWorkoutContext,
  isLikelyUuid
} from "@/lib/workout/session-access";
import { fetchPreviousSetsForExerciseAny } from "@/lib/workout/fetch-previous-sets";
import type { PreviousSet } from "@/types/workout";

type RouteContext = {
  params: {
    id: string;
  };
};

type AddExerciseRequestBody = {
  exercise_id?: string;
  /** Set when adding a personal custom exercise (user_exercises table). */
  user_exercise_id?: string;
};

type UserExerciseRow = {
  id: string;
  name: string;
  category: string | null;
};

type ExerciseRow = {
  id: string;
  slug: string;
  name_ja: string;
  name_en: string;
};

type OrderIndexRow = {
  order_index: number;
};

type InsertedSessionExerciseRow = {
  id: string;
  workout_session_id: string;
  exercise_id: string;
  exercise_type: string;
  order_index: number;
  was_added: boolean;
};

type InsertedWorkoutSetRow = {
  id: string;
  workout_session_exercise_id: string;
  set_number: number;
  target_reps_text: string | null;
  weight_kg: number | null;
  reps_done: number | null;
  is_completed: boolean;
  is_locked: boolean;
  completed_at: string | null;
  is_auto_filled: boolean;
  deleted_at: string | null;
};

function formatPrevDisplay(prev: PreviousSet | undefined): string {
  if (!prev) return "-";
  if (prev.weightKg !== null && prev.repsDone !== null) return `${prev.weightKg}kg x ${prev.repsDone}`;
  if (prev.weightKg !== null) return `${prev.weightKg}kg`;
  if (prev.repsDone !== null) return `x ${prev.repsDone}`;
  return "-";
}

export async function POST(request: Request, { params }: RouteContext) {
  const routeName = "workout-session-add-exercise";

  if (!isLikelyUuid(params.id)) {
    console.warn(`${routeName}:invalid_session_id_format`, {
      sessionId: params.id,
      cause: "query_bad_request"
    });
    return NextResponse.json(
      {
        error: {
          code: "invalid_session_id_format",
          message: "Session id must be a UUID."
        }
      },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as AddExerciseRequestBody;
    const exerciseId = body.exercise_id;
    const userExerciseId = body.user_exercise_id;

    if ((!exerciseId && !userExerciseId) || (exerciseId && userExerciseId)) {
      return NextResponse.json(
        {
          error: {
            code: "invalid_request",
            message: "Exactly one of exercise_id or user_exercise_id is required."
          }
        },
        { status: 400 }
      );
    }

    const isUserExercise = Boolean(userExerciseId);

    const { client: supabase, userId } = await getAuthenticatedWorkoutContext();

    if (!userId) {
      return NextResponse.json(
        {
          error: {
            code: "unauthenticated",
            message: "ログインすると種目を追加できます。"
          }
        },
        { status: 401 }
      );
    }

    let session;
    try {
      session = await findOwnedWorkoutSession(supabase, params.id, userId);
    } catch (lookupError) {
      console.error(`${routeName}:lookup_error`, {
        sessionId: params.id,
        userId,
        lookupError
      });
      return NextResponse.json(
        {
          error: {
            code: "session_lookup_failed",
            message: "Workout session lookup failed."
          }
        },
        { status: 500 }
      );
    }

    if (!session) {
      return NextResponse.json(
        {
          error: {
            code: "session_not_found",
            message: "Workout session was not found."
          }
        },
        { status: 404 }
      );
    }

    if (session.status !== "in_progress") {
      return NextResponse.json(
        {
          error: {
            code: "session_not_in_progress",
            message: "Only in-progress sessions can be edited."
          }
        },
        { status: 409 }
      );
    }

    const isCustomSession = session.program_day_id === null;

    // Fetch exercise metadata + current max order_index in parallel.
    // User exercises don't support previous-set history in U-1 (deferred to U-4).
    const [
      exerciseLookupResult,
      { data: existingExercises, error: existingError },
      previousSets
    ] = await Promise.all([
      isUserExercise
        ? supabase.from("user_exercises").select("id, name, category").eq("id", userExerciseId!).eq("user_id", userId!).maybeSingle<UserExerciseRow>()
        : supabase.from("exercises").select("id, slug, name_ja, name_en").eq("id", exerciseId!).maybeSingle<ExerciseRow>(),
      supabase.from("workout_session_exercises").select("order_index").eq("workout_session_id", session.id).order("order_index", { ascending: false }).limit(1),
      isCustomSession && !isUserExercise
        ? fetchPreviousSetsForExerciseAny(supabase, userId, exerciseId!)
        : Promise.resolve([] as PreviousSet[])
    ]);

    if (exerciseLookupResult.error) {
      return NextResponse.json(
        { error: { code: "exercise_lookup_failed", message: "Exercise lookup failed." } },
        { status: 500 }
      );
    }

    if (!exerciseLookupResult.data) {
      return NextResponse.json(
        { error: { code: "exercise_not_found", message: "Exercise was not found." } },
        { status: 404 }
      );
    }

    if (existingError) {
      return NextResponse.json(
        { error: { code: "order_index_lookup_failed", message: "Failed to determine order_index." } },
        { status: 500 }
      );
    }

    const maxOrderIndex =
      ((existingExercises ?? []) as OrderIndexRow[])[0]?.order_index ?? 0;
    const newOrderIndex = maxOrderIndex + 1;

    const exerciseType = isCustomSession ? "T1" : "T3";

    // Build insert payload depending on source.
    const insertPayload = isUserExercise
      ? {
          workout_session_id: session.id,
          exercise_id: null,
          user_exercise_id: userExerciseId!,
          exercise_type: exerciseType,
          order_index: newOrderIndex,
          was_added: true,
          was_swapped: false
        }
      : {
          workout_session_id: session.id,
          exercise_id: exerciseId!,
          user_exercise_id: null,
          exercise_type: exerciseType,
          order_index: newOrderIndex,
          was_added: true,
          was_swapped: false
        };

    const { data: insertedExercise, error: insertExerciseError } = await supabase
      .from("workout_session_exercises")
      .insert(insertPayload)
      .select(
        "id, workout_session_id, exercise_id, user_exercise_id, exercise_type, order_index, was_added"
      )
      .single<InsertedSessionExerciseRow & { user_exercise_id: string | null }>();

    if (insertExerciseError || !insertedExercise) {
      return NextResponse.json(
        {
          error: {
            code: "exercise_insert_failed",
            message: "Failed to add exercise to session."
          }
        },
        { status: 500 }
      );
    }

    // For custom sessions: create as many sets as the previous session had (min 1).
    // For program sessions: always create 1 set (user adds more via Add Set).
    const setCount = isCustomSession ? Math.max(1, previousSets.length) : 1;

    const setRows = Array.from({ length: setCount }, (_, i) => ({
      workout_session_exercise_id: insertedExercise.id,
      set_number: i + 1,
      target_reps_text: null,
      weight_kg: null,
      reps_done: null,
      is_completed: false,
      is_locked: false,
      is_auto_filled: false,
      deleted_at: null
    }));

    const { data: insertedSets, error: insertSetError } = await supabase
      .from("workout_sets")
      .insert(setRows)
      .select(
        "id, workout_session_exercise_id, set_number, target_reps_text, weight_kg, reps_done, is_completed, is_locked, completed_at, is_auto_filled, deleted_at"
      );

    if (insertSetError || !insertedSets || insertedSets.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "initial_set_insert_failed",
            message: "Exercise added but initial set creation failed."
          }
        },
        { status: 500 }
      );
    }

    revalidatePath("/train");

    const typedSets = insertedSets as InsertedWorkoutSetRow[];

    // Resolve display name depending on exercise source.
    const nameJa = isUserExercise
      ? (exerciseLookupResult.data as UserExerciseRow).name
      : (exerciseLookupResult.data as ExerciseRow).name_ja;
    const nameEn = isUserExercise
      ? (exerciseLookupResult.data as UserExerciseRow).name
      : (exerciseLookupResult.data as ExerciseRow).name_en;
    const slug = isUserExercise
      ? userExerciseId!
      : (exerciseLookupResult.data as ExerciseRow).slug;

    return NextResponse.json({
      sessionExercise: {
        id: insertedExercise.id,
        exerciseId: insertedExercise.exercise_id ?? null,
        userExerciseId: insertedExercise.user_exercise_id ?? null,
        exerciseSlug: slug,
        exerciseNameJa: nameJa,
        exerciseNameEn: nameEn,
        exerciseType: insertedExercise.exercise_type,
        orderIndex: insertedExercise.order_index,
        wasAdded: insertedExercise.was_added
      },
      sets: typedSets.map((s, i) => ({
        id: s.id,
        workoutSessionExerciseId: s.workout_session_exercise_id,
        setNumber: s.set_number,
        targetRepsText: s.target_reps_text,
        weightKg: s.weight_kg,
        repsDone: s.reps_done,
        isCompleted: s.is_completed,
        isLocked: s.is_locked,
        completedAt: s.completed_at,
        isAutoFilled: s.is_auto_filled,
        previousDisplay: formatPrevDisplay(previousSets[i]),
        deletedAt: s.deleted_at
      })),
      previousSets
    });
  } catch (error) {
    console.error("Failed to add exercise to workout session.", error);

    return NextResponse.json(
      {
        error: {
          code: "add_exercise_unexpected_error",
          message: "Unexpected error occurred while adding exercise."
        }
      },
      { status: 500 }
    );
  }
}

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { fetchPreviousSetsForExercise } from "@/lib/workout/fetch-previous-sets";
import {
  findOwnedWorkoutSession,
  getAuthenticatedWorkoutContext,
  isLikelyUuid
} from "@/lib/workout/session-access";

type RouteContext = {
  params: {
    id: string;
    exerciseId: string;
  };
};

type SwapRequestBody = {
  exercise_id?: string;
};

type SessionExerciseRow = {
  id: string;
  workout_session_id: string;
  exercise_id: string;
  exercise_type: string;
  order_index: number;
  was_swapped: boolean;
};

type ExerciseRow = {
  id: string;
  slug: string;
  name_ja: string;
  name_en: string;
};

type SetCheckRow = {
  id: string;
  weight_kg: number | string | null;
  reps_done: number | null;
  target_reps_text: string | null;
  is_completed: boolean;
  is_locked: boolean;
};

function parseFirstInt(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const routeName = "workout-session-swap-exercise";

  // Hard guard: non-UUID session ids never reach PostgREST.
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
    const body = (await request.json().catch(() => ({}))) as SwapRequestBody;
    const newExerciseId = body.exercise_id;

    if (!newExerciseId || typeof newExerciseId !== "string") {
      return NextResponse.json(
        {
          error: {
            code: "invalid_request",
            message: "exercise_id is required."
          }
        },
        { status: 400 }
      );
    }

    const { client: supabase, userId } = await getAuthenticatedWorkoutContext();

    if (!userId) {
      return NextResponse.json(
        {
          error: {
            code: "unauthenticated",
            message: "ログインすると種目の入れ替えができます。"
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
        sessionExerciseId: params.exerciseId,
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

    const { data: sessionExercise, error: sessionExerciseError } = await supabase
      .from("workout_session_exercises")
      .select("id, workout_session_id, exercise_id, exercise_type, order_index, was_swapped")
      .eq("id", params.exerciseId)
      .eq("workout_session_id", session.id)
      .maybeSingle<SessionExerciseRow>();

    if (sessionExerciseError) {
      return NextResponse.json(
        {
          error: {
            code: "session_exercise_lookup_failed",
            message: "Workout session exercise lookup failed."
          }
        },
        { status: 500 }
      );
    }

    if (!sessionExercise) {
      return NextResponse.json(
        {
          error: {
            code: "session_exercise_not_found",
            message: "Workout session exercise was not found in this session."
          }
        },
        { status: 404 }
      );
    }

    if (sessionExercise.exercise_id === newExerciseId) {
      const { data: currentExercise } = await supabase
        .from("exercises")
        .select("id, slug, name_ja, name_en")
        .eq("id", sessionExercise.exercise_id)
        .maybeSingle<ExerciseRow>();

      return NextResponse.json({
        noOp: true,
        sessionExercise: {
          id: sessionExercise.id,
          exerciseId: sessionExercise.exercise_id,
          exerciseSlug: currentExercise?.slug ?? sessionExercise.exercise_id,
          exerciseNameJa: currentExercise?.name_ja ?? "Exercise",
          exerciseNameEn: currentExercise?.name_en ?? "Exercise",
          exerciseType: sessionExercise.exercise_type,
          wasSwapped: sessionExercise.was_swapped
        }
      });
    }

    const { data: newExercise, error: newExerciseError } = await supabase
      .from("exercises")
      .select("id, slug, name_ja, name_en")
      .eq("id", newExerciseId)
      .maybeSingle<ExerciseRow>();

    if (newExerciseError) {
      return NextResponse.json(
        {
          error: {
            code: "exercise_lookup_failed",
            message: "Exercise lookup failed."
          }
        },
        { status: 500 }
      );
    }

    if (!newExercise) {
      return NextResponse.json(
        {
          error: {
            code: "exercise_not_found",
            message: "Exercise was not found."
          }
        },
        { status: 404 }
      );
    }

    const { data: setsForCheck, error: blockingSetsError } = await supabase
      .from("workout_sets")
      .select("id, weight_kg, reps_done, target_reps_text, is_completed, is_locked")
      .eq("workout_session_exercise_id", sessionExercise.id)
      .is("deleted_at", null);

    if (blockingSetsError) {
      return NextResponse.json(
        {
          error: {
            code: "set_check_failed",
            message: "Failed to check set state for swap."
          }
        },
        { status: 500 }
      );
    }

    // A set is considered "has user input" when:
    //   - completed or locked, OR
    //   - weight_kg is set (non-null, non-zero), OR
    //   - reps_done is set AND differs from the target reps parsed from target_reps_text.
    //     Rationale: GZCL sets auto-populate reps_done from target (e.g. 15+ → 15).
    //     That default should not block swap; only explicit user edits should.
    const hasBlockingSet = ((setsForCheck ?? []) as SetCheckRow[]).some((set) => {
      if (set.is_completed || set.is_locked) return true;
      const weightKg = set.weight_kg === null ? null : Number(set.weight_kg);
      if (weightKg !== null && weightKg !== 0) return true;
      if (set.reps_done !== null && set.reps_done !== parseFirstInt(set.target_reps_text)) return true;
      return false;
    });

    if (hasBlockingSet) {
      return NextResponse.json(
        {
          error: {
            code: "swap_blocked_by_input",
            message:
              "Cannot swap: one or more sets have been completed or have input. Remove inputs and unlock all sets before swapping."
          }
        },
        { status: 409 }
      );
    }

    const { error: updateError } = await supabase
      .from("workout_session_exercises")
      .update({
        exercise_id: newExerciseId,
        exercise_type: "T3",
        was_swapped: true
      })
      .eq("id", sessionExercise.id);

    if (updateError) {
      return NextResponse.json(
        {
          error: {
            code: "swap_update_failed",
            message: "Failed to swap exercise."
          }
        },
        { status: 500 }
      );
    }

    revalidatePath("/train");

    // Fetch previous sets for the new exercise (always T3 after swap) so the
    // client can update previousSets without a full reload.
    const previousSets = await fetchPreviousSetsForExercise(
      supabase,
      userId,
      newExercise.id,
      "T3"
    ).catch(() => []);

    return NextResponse.json({
      noOp: false,
      sessionExercise: {
        id: sessionExercise.id,
        exerciseId: newExercise.id,
        exerciseSlug: newExercise.slug,
        exerciseNameJa: newExercise.name_ja,
        exerciseNameEn: newExercise.name_en,
        exerciseType: "T3",
        wasSwapped: true
      },
      previousSets
    });
  } catch (error) {
    console.error("Failed to swap exercise in workout session.", error);

    return NextResponse.json(
      {
        error: {
          code: "swap_unexpected_error",
          message: "Unexpected error occurred while swapping exercise."
        }
      },
      { status: 500 }
    );
  }
}

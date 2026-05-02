import "server-only";

import {
  findFirstProgramDayId,
  findProgramBySlug,
  getProgramWeekPreviews
} from "@/lib/programs/program-library";
import {
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";
import { resolveStartProgramDayId } from "@/lib/workout/enrollment";
import type { ProgramDetailState, ProgramDetailView } from "@/types/programs";

type ProgramDetailResult = {
  state: ProgramDetailState;
  view: ProgramDetailView;
  errorMessage: string | null;
};

async function getCurrentUserId(): Promise<string | null> {
  if (!hasSupabasePublicEnv()) return null;
  try {
    const client = createSupabaseServerClient();
    const { data } = await client.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function getProgramDetailView(
  programSlug: string
): Promise<ProgramDetailResult> {
  try {
    const { program, source } = await findProgramBySlug(programSlug);

    if (!program) {
      return {
        state: "not_found",
        view: {
          program: null,
          source,
          firstProgramDayId: null,
          startProgramDayId: null,
          hasActiveEnrollment: false,
          weekPreviews: []
        },
        errorMessage: null
      };
    }

    const [firstProgramDayId, userId, weekPreviews] = await Promise.all([
      findFirstProgramDayId(program.id),
      getCurrentUserId(),
      getProgramWeekPreviews(program.id)
    ]);

    const { startProgramDayId, hasActiveEnrollment } = await resolveStartProgramDayId(
      program.id,
      firstProgramDayId,
      userId
    );

    return {
      state: "ready",
      view: {
        program,
        source,
        firstProgramDayId,
        startProgramDayId,
        hasActiveEnrollment,
        weekPreviews
      },
      errorMessage: null
    };
  } catch (error) {
    console.error("Failed to load program detail.", error);

    return {
      state: "error",
      view: {
        program: null,
        source: "mock_catalog",
        firstProgramDayId: null,
        startProgramDayId: null,
        hasActiveEnrollment: false,
        weekPreviews: []
      },
      errorMessage: "Program detail could not be loaded right now. Please try again."
    };
  }
}

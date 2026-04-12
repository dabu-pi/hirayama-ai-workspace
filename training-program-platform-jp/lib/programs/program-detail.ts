import "server-only";

import {
  findFirstProgramDayId,
  findProgramBySlug
} from "@/lib/programs/program-library";
import type { ProgramDetailState, ProgramDetailView } from "@/types/programs";

type ProgramDetailResult = {
  state: ProgramDetailState;
  view: ProgramDetailView;
  errorMessage: string | null;
};

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
          firstProgramDayId: null
        },
        errorMessage: null
      };
    }

    const firstProgramDayId = await findFirstProgramDayId(program.id);

    return {
      state: "ready",
      view: {
        program,
        source,
        firstProgramDayId
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
        firstProgramDayId: null
      },
      errorMessage: "Program detail could not be loaded right now. Please try again."
    };
  }
}

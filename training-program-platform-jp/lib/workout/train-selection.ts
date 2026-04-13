import "server-only";

import { findProgramBySlug } from "@/lib/programs/program-library";
import type { TrainProgramSelection } from "@/types/workout";

function normalizeStringParam(
  value: string | string[] | undefined
): string | null {
  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }

  return value?.trim() || null;
}

export async function getTrainProgramSelection(
  programParam: string | string[] | undefined,
  programDayIdParam: string | string[] | undefined
): Promise<TrainProgramSelection> {
  const requestedSlug = normalizeStringParam(programParam);
  const programDayId = normalizeStringParam(programDayIdParam);

  if (!requestedSlug) {
    return {
      state: "none",
      requestedSlug: null,
      programSlug: null,
      programTitle: null,
      programDayId: null,
      source: null,
      message: null
    };
  }

  const { program, source } = await findProgramBySlug(requestedSlug);

  if (!program) {
    return {
      state: "invalid",
      requestedSlug,
      programSlug: null,
      programTitle: null,
      programDayId: null,
      source,
      message:
        "Selected program could not be matched in the current program source. Train stayed on the current session."
    };
  }

  return {
    state: "selected",
    requestedSlug,
    programSlug: program.slug,
    programTitle: program.title,
    programDayId,
    source,
    message: null
  };
}

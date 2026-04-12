import "server-only";

import { findProgramCatalogItemBySlug } from "@/lib/programs/program-catalog";
import type { TrainProgramSelection } from "@/types/workout";

function normalizeProgramParam(
  value: string | string[] | undefined
): string | null {
  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }

  return value?.trim() || null;
}

export async function getTrainProgramSelection(
  programParam: string | string[] | undefined
): Promise<TrainProgramSelection> {
  const requestedSlug = normalizeProgramParam(programParam);

  if (!requestedSlug) {
    return {
      state: "none",
      requestedSlug: null,
      programSlug: null,
      programTitle: null,
      source: null,
      message: null
    };
  }

  const program = findProgramCatalogItemBySlug(requestedSlug);

  if (!program) {
    return {
      state: "invalid",
      requestedSlug,
      programSlug: null,
      programTitle: null,
      source: "mock_catalog",
      message:
        "Selected program could not be matched in the current catalog. Train stayed on the current session."
    };
  }

  return {
    state: "selected",
    requestedSlug,
    programSlug: program.slug,
    programTitle: program.title,
    source: "mock_catalog",
    message: null
  };
}

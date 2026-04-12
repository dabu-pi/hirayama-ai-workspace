import "server-only";

import {
  listProgramCatalogItems,
  toProgramListItem
} from "@/lib/programs/program-catalog";
import type { ProgramListState, ProgramListView } from "@/types/programs";

type ProgramListResult = {
  state: ProgramListState;
  view: ProgramListView;
  errorMessage: string | null;
};

export async function getProgramListView(): Promise<ProgramListResult> {
  try {
    const items = listProgramCatalogItems().map(toProgramListItem);

    return {
      state: items.length === 0 ? "empty" : "ready",
      view: {
        items,
        source: "mock_catalog"
      },
      errorMessage: null
    };
  } catch (error) {
    console.error("Failed to load program catalog.", error);

    return {
      state: "error",
      view: {
        items: [],
        source: "mock_catalog"
      },
      errorMessage: "Programs could not be loaded right now. Please try again."
    };
  }
}

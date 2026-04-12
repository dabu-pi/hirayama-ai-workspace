import "server-only";

import { toProgramListItem } from "@/lib/programs/program-catalog";
import { getProgramLibrary } from "@/lib/programs/program-library";
import type { ProgramListState, ProgramListView } from "@/types/programs";

type ProgramListResult = {
  state: ProgramListState;
  view: ProgramListView;
  errorMessage: string | null;
};

export async function getProgramListView(): Promise<ProgramListResult> {
  try {
    const library = await getProgramLibrary();
    const items = library.items.map(toProgramListItem);

    return {
      state: items.length === 0 ? "empty" : "ready",
      view: {
        items,
        source: library.source
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

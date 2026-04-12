export type ProgramListState = "ready" | "loading" | "empty" | "error";

export type ProgramDetailState = "ready" | "loading" | "not_found" | "error";

export type ProgramDataSource = "mock_catalog";

export type ProgramSummary = {
  id: string;
  slug: string;
  title: string;
  level: string | null;
  goal: string | null;
  frequencyLabel: string | null;
  durationLabel: string | null;
};

export type ProgramCatalogItem = ProgramSummary & {
  overview: string;
};

export type ProgramListItem = ProgramSummary;

export type ProgramListView = {
  items: ProgramListItem[];
  source: ProgramDataSource;
};

export type ProgramDetailView = {
  program: ProgramCatalogItem | null;
  source: ProgramDataSource;
};

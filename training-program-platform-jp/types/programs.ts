export type ProgramListState = "ready" | "loading" | "empty" | "error";

export type ProgramListDataSource = "mock_catalog";

export type ProgramListItem = {
  id: string;
  slug: string;
  title: string;
  level: string | null;
  goal: string | null;
  frequencyLabel: string | null;
  durationLabel: string | null;
};

export type ProgramListView = {
  items: ProgramListItem[];
  source: ProgramListDataSource;
};

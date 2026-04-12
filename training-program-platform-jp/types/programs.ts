export type ProgramListState = "ready" | "loading" | "empty" | "error";

export type ProgramDetailState = "ready" | "loading" | "not_found" | "error";

export type ProgramDataSource = "mock_catalog" | "supabase";

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
  /** UUID of week 1 / day 1 for this program. null if not found or Supabase unavailable. */
  firstProgramDayId: string | null;
  /**
   * The day to start from when the user taps "Go to Train".
   * Priority: active enrollment's current_program_day_id > firstProgramDayId > null.
   */
  startProgramDayId: string | null;
  /** True when there is an active enrollment for this program. */
  hasActiveEnrollment: boolean;
};

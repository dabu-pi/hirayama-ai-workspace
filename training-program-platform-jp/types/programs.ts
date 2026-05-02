export type ProgramListState = "ready" | "loading" | "empty" | "error";

export type ProgramDetailState = "ready" | "loading" | "not_found" | "error";

export type ProgramDataSource = "mock_catalog" | "supabase";

export type ProgramLevel = "beginner" | "intermediate" | "advanced";

export type ProgramSourceFidelity = "original" | "adapted" | "custom";

/**
 * C-13: Training methodology that describes a program's slot structure.
 * - gzcl    : GZCL T1/T2/T3 slot structure
 * - linear  : Linear progression (e.g. Starting Strength)
 * - generic : No methodology-specific structure or progression state
 */
export type MethodologyType = "gzcl" | "linear" | "generic";

export type ProgramTagAxis = "goal" | "equipment" | "split" | "focus";

export type ProgramTag = {
  slug: string;
  label: string;
  axis: ProgramTagAxis;
  description: string | null;
  sortOrder: number;
};

export type ProgramSummary = {
  id: string;
  slug: string;
  title: string;
  level: string | null;
  levelKey: ProgramLevel | null;
  goal: string | null;
  frequencyLabel: string | null;
  durationLabel: string | null;
  sourceProgramName: string | null;
  sourceFidelity: ProgramSourceFidelity | null;
  sourceNotes: string | null;
  tags: ProgramTag[];
  /** C-13: Training methodology. Defaults to 'gzcl' when column is absent. */
  methodology: MethodologyType;
};

export type ProgramCatalogItem = ProgramSummary & {
  overview: string;
};

export type ProgramListItem = ProgramSummary;

export type ProgramListView = {
  items: ProgramListItem[];
  source: ProgramDataSource;
};

export type ExercisePreview = {
  nameEn: string;
  nameJa: string | null;
  exerciseType: string | null;
};

export type DayPreview = {
  dayNumber: number;
  exercises: ExercisePreview[];
};

export type WeekPreview = {
  weekNumber: number;
  label: string | null;
  days: DayPreview[];
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
  /** Week-by-week structure preview. Empty array when Supabase unavailable. */
  weekPreviews: WeekPreview[];
};

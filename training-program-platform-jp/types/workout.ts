import type { ProgramDataSource } from "@/types/programs";

export type ExerciseType = "T1" | "T2" | "T3";

export type WorkoutSessionStatus = "in_progress" | "completed" | "cancelled";

export type PreviousSet = {
  setNumber: number;
  weightKg: number | null;
  repsDone: number | null;
};

export type WorkoutSet = {
  id: string;
  setNumber: number;
  displaySetNumber: number;
  targetRepsText: string | null;
  weightKg: number | null;
  repsDone: number | null;
  isCompleted: boolean;
  isLocked: boolean;
  completedAt: string | null;
  isAutoFilled: boolean;
  note: string;
  previousDisplay: string;
  deletedAt: string | null;
};

export type WorkoutExerciseBlock = {
  id: string;
  exerciseId: string;
  exerciseSlug: string;
  exerciseNameJa: string;
  exerciseNameEn: string;
  exerciseType: ExerciseType;
  orderIndex: number;
  previousSets: PreviousSet[];
  sets: WorkoutSet[];
  wasAdded?: boolean;
  wasSwapped?: boolean;
};

export type WorkoutSessionView = {
  id: string;
  userId: string;
  programEnrollmentId: string | null;
  programDayId: string | null;
  programTitle: string;
  programWeekLabel: string;
  progressionGuide: string;
  notes: string;
  startedAt: string;
  finishedAt: string | null;
  status: WorkoutSessionStatus;
  incompleteSetCount: number;
  exercises: WorkoutExerciseBlock[];
};

export type TrainProgramSelectionState = "none" | "selected" | "invalid";

export type TrainProgramSelection = {
  state: TrainProgramSelectionState;
  requestedSlug: string | null;
  programSlug: string | null;
  programTitle: string | null;
  /** UUID of the target program_day passed via ?programDayId= query param. */
  programDayId: string | null;
  source: ProgramDataSource | null;
  message: string | null;
};

export type ExerciseListItem = {
  id: string;
  nameJa: string;
  nameEn: string;
  category: string | null;
};

export type AddExerciseResponse = {
  sessionExercise: {
    id: string;
    exerciseId: string;
    exerciseSlug: string;
    exerciseNameJa: string;
    exerciseNameEn: string;
    exerciseType: ExerciseType;
    orderIndex: number;
    wasAdded: boolean;
  };
  initialSet: {
    id: string;
    workoutSessionExerciseId: string;
    setNumber: number;
    targetRepsText: string | null;
    weightKg: number | null;
    repsDone: number | null;
    isCompleted: boolean;
    isLocked: boolean;
    completedAt: string | null;
    isAutoFilled: boolean;
    previousDisplay: string;
    deletedAt: string | null;
  };
};

export type SwapExerciseResponse = {
  noOp: boolean;
  sessionExercise: {
    id: string;
    exerciseId: string;
    exerciseSlug: string;
    exerciseNameJa: string;
    exerciseNameEn: string;
    exerciseType: ExerciseType;
    wasSwapped: boolean;
  };
};

export type ExerciseHistorySet = {
  setNumber: number;
  weightKg: number | null;
  repsDone: number | null;
  note: string;
};

export type ExerciseHistorySession = {
  sessionId: string;
  sessionDate: string;
  programLabel: string;
  sets: ExerciseHistorySet[];
};

export type ExerciseHistoryView = {
  exerciseSlug: string;
  exerciseNameJa: string;
  exerciseNameEn: string;
  exerciseType: ExerciseType;
  sessions: ExerciseHistorySession[];
};

export type WorkoutSummaryExercise = {
  id: string;
  exerciseId: string;
  exerciseSlug: string;
  exerciseNameJa: string;
  exerciseNameEn: string;
  exerciseType: ExerciseType;
  orderIndex: number;
  completedSetCount: number;
  totalVisibleSetCount: number;
  wasAdded: boolean;
  wasSwapped: boolean;
};

export type WorkoutSummaryView = {
  sessionId: string;
  userId: string;
  status: WorkoutSessionStatus;
  programTitle: string;
  programWeekLabel: string;
  startedAt: string;
  finishedAt: string | null;
  totalCompletedSets: number;
  totalVisibleSets: number;
  exercises: WorkoutSummaryExercise[];
};

export type WorkoutSummaryState =
  | "ready"
  | "loading"
  | "unauthenticated"
  | "not_found"
  | "not_completed"
  | "error";

export type WorkoutSessionFinishResponse = {
  id: string;
  status: WorkoutSessionStatus;
  finishedAt: string | null;
  incompleteSetCount: number;
  summaryPath: string;
  requiresConfirmation?: boolean;
  message?: string;
};

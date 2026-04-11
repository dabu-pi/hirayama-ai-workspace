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

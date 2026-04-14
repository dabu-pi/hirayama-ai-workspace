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
  userId: string | null;
  status: WorkoutSessionStatus;
  programTitle: string;
  programWeekLabel: string;
  startedAt: string;
  finishedAt: string | null;
  totalCompletedSets: number;
  totalVisibleSets: number;
  exercises: WorkoutSummaryExercise[];
  /**
   * True when the completed session was the final day of the program.
   * Derived from findNextProgramDayId returning null for the session's program_day_id.
   */
  isProgramCompleted: boolean;
  /**
   * Human-readable label for the next session (e.g. "Week 2 / Day 1").
   * Null when isProgramCompleted is true or program_day_id is unavailable.
   */
  nextProgramDayLabel: string | null;
  /**
   * UUID of the next program_day. Used to build the direct /train CTA URL.
   * Null when isProgramCompleted is true or program_day_id is unavailable.
   */
  nextProgramDayId: string | null;
  /**
   * Slug of the program the session belongs to.
   * Used alongside nextProgramDayId to build /train?program=<slug>&programDayId=<uuid>.
   * Null when the session has no associated program.
   */
  programSlug: string | null;
  /**
   * UUID of the first program_day (Week 1 / Day 1) of the program.
   * Populated only when isProgramCompleted is true.
   * Used to build the "Restart Program" re-enroll CTA.
   * Null when the session has no associated program or first day could not be resolved.
   */
  firstProgramDayId: string | null;
};

export type WorkoutSessionListItem = {
  sessionId: string;
  status: WorkoutSessionStatus;
  /** YYYY-MM-DD derived from started_at */
  startedAt: string;
  finishedAt: string | null;
  programTitle: string | null;
  /** "Week N / Day N" or null when session has no program */
  programWeekDayLabel: string | null;
  exerciseCount: number;
};

export type SessionHistoryResult = {
  sessions: WorkoutSessionListItem[];
  errorMessage: string | null;
};

export type WorkoutSessionDetailSet = {
  id: string;
  setNumber: number;
  weightKg: number | null;
  repsDone: number | null;
  isCompleted: boolean;
  note: string;
};

export type WorkoutSessionDetailExercise = {
  id: string;
  exerciseId: string;
  exerciseSlug: string;
  exerciseNameJa: string;
  exerciseNameEn: string;
  exerciseType: ExerciseType;
  orderIndex: number;
  wasAdded: boolean;
  wasSwapped: boolean;
  sets: WorkoutSessionDetailSet[];
};

export type WorkoutSessionDetailView = {
  sessionId: string;
  status: WorkoutSessionStatus;
  startedAt: string;
  finishedAt: string | null;
  programTitle: string | null;
  programWeekDayLabel: string | null;
  exercises: WorkoutSessionDetailExercise[];
};

export type SessionDetailResult = {
  detail: WorkoutSessionDetailView | null;
  errorMessage: string | null;
};

export type WorkoutSummaryState =
  | "ready"
  | "loading"
  | "unauthenticated"
  | "not_found"
  | "not_completed"
  | "error";

export type ActiveProgramSession = {
  sessionId: string;
  /** YYYY-MM-DD */
  startedAt: string;
  status: WorkoutSessionStatus;
  programWeekDayLabel: string | null;
};

/**
 * H-4b: Estimated 1RM trend for one active enrollment.
 *
 * Formula: Epley — e1RM = weight_kg × (1 + reps_done / 30)
 * Scope:
 *   - T1 exercises only (exercise_type = 'T1' in workout_session_exercises)
 *   - Primary T1 lift = T1 exercise_id that appears in the most sessions
 *   - Session representative = max e1RM among all T1 completed sets in that session
 *   - Only sessions with at least one qualifying T1 set appear in recentE1RMs
 */
export type E1RMTrend = {
  /**
   * Max T1 e1RM per session in chronological order (oldest → newest).
   * Only sessions where primary-T1 data exists are included.
   * Values are rounded to 1 decimal (e.g. 142.5).
   */
  recentE1RMs: number[];
  /** Max T1 e1RM in the most recent session with data. null when none. */
  latestE1RM: number | null;
  /** Max T1 e1RM in the second-most-recent session with data. null when fewer than 2. */
  previousE1RM: number | null;
  /**
   * Percentage change from previousE1RM to latestE1RM (1 decimal, e.g. 4.8).
   * null when fewer than 2 sessions with data or previousE1RM is 0.
   */
  e1rmChangePercent: number | null;
};

/**
 * H-4: Session volume trend for one active enrollment.
 * Volume = sum of (weight_kg × reps_done) for completed, non-deleted sets
 * across completed sessions tied to this enrollment.
 * Bodyweight / weight-null sets are excluded from the sum (but sessions still counted).
 */
export type VolumeTrend = {
  /**
   * Session volumes in chronological order (oldest → newest). Length 0–6.
   * Each value is Math.round(weight_kg * reps_done sum) for that session.
   */
  recentVolumes: number[];
  /** Volume of the most recent completed session. null when no completed sessions. */
  latestVolume: number | null;
  /** Volume of the second-most-recent completed session. null when fewer than 2. */
  previousVolume: number | null;
  /**
   * Percentage change from previousVolume to latestVolume (1 decimal, e.g. 11.7).
   * null when fewer than 2 sessions or previousVolume is 0.
   */
  volumeChangePercent: number | null;
};

export type ActiveProgramView = {
  enrollmentId: string;
  programId: string;
  programSlug: string;
  programTitle: string;
  level: string | null;
  /** e.g. "4 days / week" */
  frequencyLabel: string;
  /** e.g. "12 weeks" */
  durationLabel: string;
  currentProgramDayId: string | null;
  /** e.g. "Week 2 / Day 1" — null when enrollment has no current day set */
  currentWeekDayLabel: string | null;
  /** /train?program=<slug>&programDayId=<uuid> or /train?program=<slug> when day is null */
  continueUrl: string;
  enrollmentStartedAt: string;
  recentSessions: ActiveProgramSession[];
  /** Days completed before current_program_day_id (0 = first day not yet started) */
  completedDays: number;
  /** Total program_days in the program */
  totalDays: number;
  /** 0–100, Math.round. 0 when totalDays is 0. */
  progressPercent: number;
  /** H-4: Volume trend for this enrollment's recent completed sessions. */
  trend: VolumeTrend;
  /** H-4b: Estimated 1RM trend for the primary T1 lift of this enrollment. */
  e1rmTrend: E1RMTrend;
  /**
   * S-2: CTA action type derived from in-progress session state.
   * 'resume' — an in_progress session exists for this enrollment.
   * 'start'  — no in_progress session; current_program_day_id is set.
   * 'none'   — current_program_day_id is null (edge case; CTA falls back to generic).
   */
  actionType: "start" | "resume" | "none";
  /**
   * S-2: Session ID of the in_progress session for this enrollment.
   * null when actionType is 'start' or 'none'.
   */
  activeSessionId: string | null;
};

export type ActiveProgramResult = {
  /**
   * All active enrollments for the current user, ordered by most-recently-updated first.
   * Empty array when the user has no active enrollment.
   */
  views: ActiveProgramView[];
  /** true = user is signed in but has no active enrollment */
  isAuthenticated: boolean;
  errorMessage: string | null;
};

export type WorkoutSessionFinishResponse = {
  id: string;
  status: WorkoutSessionStatus;
  finishedAt: string | null;
  incompleteSetCount: number;
  summaryPath: string;
  requiresConfirmation?: boolean;
  message?: string;
};

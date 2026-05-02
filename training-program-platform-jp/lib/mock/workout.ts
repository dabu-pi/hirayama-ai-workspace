import type {
  ExerciseHistoryView,
  WorkoutSessionView
} from "@/types/workout";

const workoutSession: WorkoutSessionView = {
  id: "session-demo-20260411",
  userId: "user-demo-admin",
  programEnrollmentId: "enrollment-demo-001",
  programDayId: "program-day-demo-001",
  programTitle: "5/3/1 Beginner",
  programWeekLabel: "Week 2 / Day 1",
  progressionGuide:
    "main set（メインセット）は前回超えを狙い、last set（最終セット）は無理のない範囲で回数を伸ばす。",
  notes:
    "UI はダミーデータ表示中。ここから Supabase 接続と Route Handlers（同一アプリ内API）へ差し替えていく。",
  startedAt: "2026-04-11T09:00:00Z",
  finishedAt: null,
  status: "in_progress",
  incompleteSetCount: 8,
  exercises: [
    {
      id: "wse-bench-001",
      exerciseId: "exercise-bench-press",
      exerciseSlug: "bench-press",
      exerciseNameJa: "ベンチプレス",
      exerciseNameEn: "Bench Press",
      exerciseType: "T1",
      exerciseRoleLabel: "T1",
      orderIndex: 1,
      previousSets: [
        { setNumber: 1, weightKg: 80, repsDone: 5 },
        { setNumber: 2, weightKg: 80, repsDone: 5 },
        { setNumber: 3, weightKg: 80, repsDone: 7 }
      ],
      sets: [
        {
          id: "set-bench-1",
          setNumber: 1,
          displaySetNumber: 1,
          targetRepsText: "5",
          weightKg: null,
          repsDone: null,
          isCompleted: false,
          isLocked: false,
          completedAt: null,
          isAutoFilled: false,
          note: "",
          previousDisplay: "80kg×5",
          deletedAt: null
        },
        {
          id: "set-bench-2",
          setNumber: 2,
          displaySetNumber: 2,
          targetRepsText: "5",
          weightKg: null,
          repsDone: null,
          isCompleted: false,
          isLocked: false,
          completedAt: null,
          isAutoFilled: false,
          note: "",
          previousDisplay: "80kg×5",
          deletedAt: null
        },
        {
          id: "set-bench-3",
          setNumber: 3,
          displaySetNumber: 3,
          targetRepsText: "5+",
          weightKg: null,
          repsDone: null,
          isCompleted: false,
          isLocked: false,
          completedAt: null,
          isAutoFilled: false,
          note: "AMRAP",
          previousDisplay: "80kg×7",
          deletedAt: null
        }
      ]
    },
    {
      id: "wse-squat-001",
      exerciseId: "exercise-squat",
      exerciseSlug: "squat",
      exerciseNameJa: "スクワット",
      exerciseNameEn: "Squat",
      exerciseType: "T2",
      exerciseRoleLabel: "T2",
      orderIndex: 2,
      previousSets: [
        { setNumber: 1, weightKg: 100, repsDone: 8 },
        { setNumber: 2, weightKg: 100, repsDone: 8 },
        { setNumber: 3, weightKg: 100, repsDone: 6 }
      ],
      sets: [
        {
          id: "set-squat-1",
          setNumber: 1,
          displaySetNumber: 1,
          targetRepsText: "8",
          weightKg: null,
          repsDone: null,
          isCompleted: false,
          isLocked: false,
          completedAt: null,
          isAutoFilled: false,
          note: "",
          previousDisplay: "100kg×8",
          deletedAt: null
        },
        {
          id: "set-squat-2",
          setNumber: 2,
          displaySetNumber: 2,
          targetRepsText: "8",
          weightKg: null,
          repsDone: null,
          isCompleted: false,
          isLocked: false,
          completedAt: null,
          isAutoFilled: false,
          note: "",
          previousDisplay: "100kg×8",
          deletedAt: null
        },
        {
          id: "set-squat-3",
          setNumber: 3,
          displaySetNumber: 3,
          targetRepsText: "8",
          weightKg: null,
          repsDone: null,
          isCompleted: false,
          isLocked: false,
          completedAt: null,
          isAutoFilled: false,
          note: "",
          previousDisplay: "100kg×6",
          deletedAt: null
        }
      ]
    },
    {
      id: "wse-lat-001",
      exerciseId: "exercise-lat-pulldown",
      exerciseSlug: "lat-pulldown",
      exerciseNameJa: "ラットプルダウン",
      exerciseNameEn: "Lat Pulldown",
      exerciseType: "T3",
      exerciseRoleLabel: "T3",
      orderIndex: 3,
      previousSets: [],
      sets: [
        {
          id: "set-lat-1",
          setNumber: 1,
          displaySetNumber: 1,
          targetRepsText: "12",
          weightKg: null,
          repsDone: null,
          isCompleted: false,
          isLocked: false,
          completedAt: null,
          isAutoFilled: false,
          note: "",
          previousDisplay: "-",
          deletedAt: null
        },
        {
          id: "set-lat-2",
          setNumber: 2,
          displaySetNumber: 2,
          targetRepsText: "12",
          weightKg: null,
          repsDone: null,
          isCompleted: false,
          isLocked: false,
          completedAt: null,
          isAutoFilled: false,
          note: "",
          previousDisplay: "-",
          deletedAt: null
        }
      ]
    }
  ]
};

const historyBySlug: Record<string, ExerciseHistoryView> = {
  "bench-press": {
    exerciseSlug: "bench-press",
    exerciseNameJa: "ベンチプレス",
    exerciseNameEn: "Bench Press",
    exerciseType: "T1",
    sessions: [
      {
        sessionId: "session-20260401-bench",
        sessionDate: "2026-04-01",
        programLabel: "GZCLP Week 8 Day 1",
        sets: [
          { setNumber: 1, weightKg: 80, repsDone: 3, note: "" },
          { setNumber: 2, weightKg: 80, repsDone: 3, note: "" },
          { setNumber: 3, weightKg: 80, repsDone: 7, note: "AMRAP" }
        ]
      },
      {
        sessionId: "session-20260328-bench",
        sessionDate: "2026-03-28",
        programLabel: "GZCLP Week 7 Day 3",
        sets: [
          { setNumber: 1, weightKg: 77.5, repsDone: 3, note: "" },
          { setNumber: 2, weightKg: 77.5, repsDone: 3, note: "" },
          { setNumber: 3, weightKg: 77.5, repsDone: 3, note: "" }
        ]
      }
    ]
  },
  squat: {
    exerciseSlug: "squat",
    exerciseNameJa: "スクワット",
    exerciseNameEn: "Squat",
    exerciseType: "T2",
    sessions: [
      {
        sessionId: "session-20260401-squat",
        sessionDate: "2026-04-01",
        programLabel: "5/3/1 Week 2 Day 1",
        sets: [
          { setNumber: 1, weightKg: 100, repsDone: 8, note: "" },
          { setNumber: 2, weightKg: 100, repsDone: 8, note: "" },
          { setNumber: 3, weightKg: 100, repsDone: 6, note: "" }
        ]
      },
      {
        sessionId: "session-20260328-squat",
        sessionDate: "2026-03-28",
        programLabel: "5/3/1 Week 1 Day 3",
        sets: [
          { setNumber: 1, weightKg: 97.5, repsDone: 8, note: "" },
          { setNumber: 2, weightKg: 97.5, repsDone: 8, note: "" },
          { setNumber: 3, weightKg: 97.5, repsDone: 8, note: "" }
        ]
      }
    ]
  },
  "lat-pulldown": {
    exerciseSlug: "lat-pulldown",
    exerciseNameJa: "ラットプルダウン",
    exerciseNameEn: "Lat Pulldown",
    exerciseType: "T3",
    sessions: []
  }
};

export function getMockWorkoutSession(sessionId?: string): WorkoutSessionView {
  if (sessionId && sessionId !== workoutSession.id) {
    return {
      ...workoutSession,
      id: sessionId
    };
  }

  return workoutSession;
}

export function getMockWorkoutSessions(): WorkoutSessionView[] {
  return [workoutSession];
}

export function getMockExerciseHistory(
  exerciseSlug: string
): ExerciseHistoryView | undefined {
  return historyBySlug[exerciseSlug];
}

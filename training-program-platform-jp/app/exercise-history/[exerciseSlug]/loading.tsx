import { ExerciseHistoryScreen } from "@/components/history/ExerciseHistoryScreen";

const loadingHistory = {
  exerciseSlug: "loading",
  exerciseNameJa: "読み込み中",
  exerciseNameEn: "Exercise History",
  exerciseType: "T3" as const,
  sessions: []
};

export default function ExerciseHistoryLoading() {
  return <ExerciseHistoryScreen history={loadingHistory} isLoading />;
}

import { ExerciseHistoryScreen } from "@/components/history/ExerciseHistoryScreen";
import { getMockExerciseHistory } from "@/lib/mock/workout";

type ExerciseHistoryPageProps = {
  params: {
    exerciseSlug: string;
  };
};

export default function ExerciseHistoryPage({
  params
}: ExerciseHistoryPageProps) {
  const history = getMockExerciseHistory(params.exerciseSlug) ?? {
    exerciseSlug: params.exerciseSlug,
    exerciseNameJa: "未登録種目",
    exerciseNameEn: params.exerciseSlug,
    exerciseType: "T3" as const,
    sessions: []
  };

  return <ExerciseHistoryScreen history={history} />;
}

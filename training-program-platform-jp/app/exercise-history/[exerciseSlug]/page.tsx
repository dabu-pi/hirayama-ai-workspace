import { ExerciseHistoryScreen } from "@/components/history/ExerciseHistoryScreen";
import { getExerciseHistoryView } from "@/lib/workout/exercise-history";

export const dynamic = "force-dynamic";

type ExerciseHistoryPageProps = {
  params: {
    exerciseSlug: string;
  };
};

export default async function ExerciseHistoryPage({
  params
}: ExerciseHistoryPageProps) {
  const { history, errorMessage } = await getExerciseHistoryView(
    params.exerciseSlug
  );

  return <ExerciseHistoryScreen errorMessage={errorMessage} history={history} />;
}

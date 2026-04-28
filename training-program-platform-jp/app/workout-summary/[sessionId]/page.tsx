import { WorkoutSummaryScreen } from "@/components/summary/WorkoutSummaryScreen";
import { getWorkoutSummaryView } from "@/lib/workout/workout-summary";

export const dynamic = "force-dynamic";

type WorkoutSummaryPageProps = {
  params: {
    sessionId: string;
  };
};

export default async function WorkoutSummaryPage({
  params
}: WorkoutSummaryPageProps) {
  const { summary, state, errorMessage } = await getWorkoutSummaryView(
    params.sessionId
  );

  return (
    <WorkoutSummaryScreen
      errorMessage={errorMessage}
      state={state}
      summary={summary}
    />
  );
}

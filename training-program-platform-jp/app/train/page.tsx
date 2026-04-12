import { WorkoutScreen } from "@/components/workout/WorkoutScreen";
import { getTrainProgramSelection } from "@/lib/workout/train-selection";
import { getCurrentWorkoutSessionView } from "@/lib/workout/train-session";

export const dynamic = "force-dynamic";

type TrainPageProps = {
  searchParams?: {
    program?: string | string[];
  };
};

export default async function TrainPage({ searchParams }: TrainPageProps) {
  const [session, selectedProgram] = await Promise.all([
    getCurrentWorkoutSessionView(),
    getTrainProgramSelection(searchParams?.program)
  ]);

  return <WorkoutScreen selectedProgram={selectedProgram} session={session} />;
}

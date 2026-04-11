import { WorkoutScreen } from "@/components/workout/WorkoutScreen";
import { getCurrentWorkoutSessionView } from "@/lib/workout/train-session";

export const dynamic = "force-dynamic";

export default async function TrainPage() {
  const session = await getCurrentWorkoutSessionView();

  return <WorkoutScreen session={session} />;
}

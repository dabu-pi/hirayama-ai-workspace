export const dynamic = "force-dynamic";

import { getWorkoutSessionDetailView } from "@/lib/workout/session-detail";
import { SessionDetailScreen } from "@/components/history/SessionDetailScreen";

type Props = {
  params: Promise<{ sessionId: string }>;
};

export default async function SessionDetailPage({ params }: Props) {
  const { sessionId } = await params;
  const { detail, errorMessage } = await getWorkoutSessionDetailView(sessionId);

  return <SessionDetailScreen detail={detail} errorMessage={errorMessage} />;
}

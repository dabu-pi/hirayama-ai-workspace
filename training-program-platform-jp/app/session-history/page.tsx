import { SessionHistoryScreen } from "@/components/history/SessionHistoryScreen";
import { getSessionHistoryView } from "@/lib/workout/session-list";

export const dynamic = "force-dynamic";

export default async function SessionHistoryPage() {
  const { sessions, errorMessage } = await getSessionHistoryView();

  return <SessionHistoryScreen errorMessage={errorMessage} sessions={sessions} />;
}

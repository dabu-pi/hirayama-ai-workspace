import { SessionHistoryScreen } from "@/components/history/SessionHistoryScreen";
import { getCalendarMonthData, getSessionHistoryView } from "@/lib/workout/session-list";

export const dynamic = "force-dynamic";

export default async function SessionHistoryPage() {
  const now = new Date();
  // Use UTC month as JST approximation; getCalendarMonthData filters by JST date string.
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed

  const [{ sessions, errorMessage }, { entries: calendarEntries }] = await Promise.all([
    getSessionHistoryView(),
    getCalendarMonthData(year, month),
  ]);

  return (
    <SessionHistoryScreen
      calendarEntries={calendarEntries}
      errorMessage={errorMessage}
      sessions={sessions}
    />
  );
}

/**
 * Converts "Week N / Day M" (DB/API format) to "Week N · Day M" (display format).
 * Strings that don't contain " / " are returned unchanged.
 */
export function formatWeekDay(raw: string): string {
  return raw.replace(" / ", " · ");
}

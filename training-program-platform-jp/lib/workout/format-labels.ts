/**
 * Converts "Week N / Day M" or "Week N · Day M" to "N週目 · M日目" (Japanese display format).
 * Strings that don't match the Week/Day pattern are returned with separator normalized to " · ".
 */
export function formatWeekDay(raw: string): string {
  return raw
    .replace(" / ", " · ")
    .replace(/Week (\d+)/g, (_, n) => `${n}週目`)
    .replace(/Day (\d+)/g, (_, n) => `${n}日目`);
}

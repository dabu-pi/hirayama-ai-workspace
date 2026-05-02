/**
 * JST (Asia/Tokyo) date formatting utilities.
 *
 * DB stores timestamps in UTC. All display and "today / yesterday" judgements
 * must use JST so users in Japan see the correct date.
 *
 * Safe in both Node.js (server) and browser (client) — Intl.DateTimeFormat
 * with timeZone is available everywhere this app runs.
 */

const JST = "Asia/Tokyo" as const;

/**
 * Returns "YYYY-MM-DD" in JST from any ISO timestamp.
 * Replaces the unsafe `toISOString().slice(0, 10)` pattern which is always UTC.
 *
 * - Plain "YYYY-MM-DD" strings are returned as-is (already date-only, no zone).
 * - Invalid strings fall back to the first 10 characters of the input.
 */
export function jstDateSlice(isoString: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) return isoString;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString.slice(0, 10);
  // sv-SE locale reliably produces YYYY-MM-DD format.
  return d.toLocaleDateString("sv", { timeZone: JST });
}

/**
 * Returns "2024年1月15日" (ja-JP long date) in JST.
 * Returns "記録なし" for null / invalid values.
 */
export function formatJstDate(value: string | null | undefined): string {
  if (!value) return "記録なし";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "記録なし";
  return d.toLocaleDateString("ja-JP", {
    timeZone: JST,
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

/**
 * Returns "2024/01/15 23:45:00" (ja-JP locale datetime) in JST.
 * Returns "記録なし" for null / invalid values.
 */
export function formatJstDateTime(value: string | null | undefined): string {
  if (!value) return "記録なし";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "記録なし";
  return d.toLocaleString("ja-JP", { timeZone: JST });
}

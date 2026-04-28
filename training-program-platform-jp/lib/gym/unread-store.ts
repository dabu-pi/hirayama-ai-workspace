// Client-only localStorage utility for gym announcement unread tracking.
// DB-backed read tracking is planned for a future phase (see ROADMAP.md G-3-DB).

const READ_KEY = "gym_announcements_read_ids";
const UNREAD_COUNT_KEY = "gym_unread_count";

function safeParseIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function getReadIds(): string[] {
  if (typeof window === "undefined") return [];
  return safeParseIds(READ_KEY);
}

export function getCachedUnreadCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(UNREAD_COUNT_KEY);
    return raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
  } catch {
    return 0;
  }
}

export function saveUnreadCount(count: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(UNREAD_COUNT_KEY, String(count));
    window.dispatchEvent(new Event("gym_unread_updated"));
  } catch {
    // localStorage unavailable (private browsing, storage quota exceeded, etc.)
  }
}

export function markAsRead(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const existing = new Set(getReadIds());
    ids.forEach((id) => existing.add(id));
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(existing)));
    localStorage.setItem(UNREAD_COUNT_KEY, "0");
    window.dispatchEvent(new Event("gym_unread_updated"));
  } catch {
    // localStorage unavailable
  }
}

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

/**
 * Slug-first tag label translation map.
 * Used so that even if the DB still has English labels, the UI shows Japanese.
 */
const TAG_LABEL_BY_SLUG: Record<string, string> = {
  "strength":        "筋力アップ",
  "general-fitness": "総合フィットネス",
  "barbell":         "バーベル",
  "dumbbell":        "ダンベル",
  "full-body":       "全身",
  "upper-lower":     "上半身 / 下半身",
  "squat-focus":     "スクワット重視",
  "explosive":       "爆発系",
  "hypertrophy":     "筋肥大",
  "powerlifting":    "パワーリフティング",
  "conditioning":    "体力づくり",
  "upper-body":      "上半身",
  "lower-body":      "下半身",
  "push":            "押す種目",
  "pull":            "引く種目",
  "legs":            "脚",
  "core":            "体幹",
};

/** Fallback map for when only the label string is available (no slug). */
const TAG_LABEL_BY_EN: Record<string, string> = {
  "Strength":        "筋力アップ",
  "General Fitness": "総合フィットネス",
  "Barbell":         "バーベル",
  "Dumbbell":        "ダンベル",
  "Full Body":       "全身",
  "Upper / Lower":   "上半身 / 下半身",
  "Upper Lower":     "上半身 / 下半身",
  "Squat Focus":     "スクワット重視",
  "Explosive":       "爆発系",
  "Hypertrophy":     "筋肥大",
  "Powerlifting":    "パワーリフティング",
  "Conditioning":    "体力づくり",
  "Upper Body":      "上半身",
  "Lower Body":      "下半身",
  "Push":            "押す種目",
  "Pull":            "引く種目",
  "Legs":            "脚",
  "Core":            "体幹",
};

/**
 * Returns the Japanese display label for a program tag.
 * Looks up by slug first (most reliable), then by label string.
 * Falls back to the original label if no translation found.
 */
export function formatProgramTagLabel(slug: string, label: string): string {
  return TAG_LABEL_BY_SLUG[slug] ?? TAG_LABEL_BY_EN[label] ?? label;
}

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

// ---------------------------------------------------------------------------
// Program title / goal / overview translations (slug-based)
// Used when DB still has English values.
// ---------------------------------------------------------------------------

const PROGRAM_TITLE_BY_SLUG: Record<string, string> = {
  "gzclp-base":             "GZCLP 基礎プログラム",
  "gzclp-base-v2":          "GZCLP 基礎プログラム（改）",
  "gzclp-base-v2-4day":     "GZCLP 基礎 4日/週（4週）",
  "big3-2day":               "BIG3 2日/週（4週）",
  "big3-3day":               "BIG3 3日/週（4週）",
  "big3-2day-6week":         "BIG3 2日/週（6週）",
  "barbell-2day-base":       "バーベル全身 2日/週（4週）",
  "starting-strength-base":  "スターティングストレングス 基礎",
  "upper-lower-base":        "アッパー/ロワー 基礎",
  "dumbbell-full-body-base": "ダンベル全身 基礎",
};

const PROGRAM_GOAL_BY_SLUG: Record<string, string> = {
  "gzclp-base":
    "T1/T2/T3の3段階構成で、メイン種目の筋力と補助種目のボリュームを同時に高める。",
  "gzclp-base-v2":
    "週3回のトレーニングでスクワット・ベンチプレス・デッドリフト・プレスをバランスよく鍛え、筋力と筋量を着実に積み上げる。",
  "gzclp-base-v2-4day":
    "週4回のトレーニングで、スクワット・ベンチプレス・デッドリフト・プレスをバランスよく鍛え、筋力と筋量を少しずつ積み上げていく。",
  "big3-2day":
    "スクワット・ベンチプレス・デッドリフトの3種目で構成するローテーション型の週2日プログラム。",
  "big3-3day":
    "スクワット・ベンチプレス・デッドリフトの3種目に集中し、基礎筋力を効率よく構築する。",
  "big3-2day-6week":
    "6週間でBIG3の全順列をカバーし、各種目がT1・T2・T3をそれぞれ均等に担当する完全対称プログラム。",
  "barbell-2day-base":
    "週2回のバーベル全身トレーニングで、スクワット・デッドリフト・ベンチプレス・オーバーヘッドプレス・バーベルローにより全身を効率よく鍛える。",
  "starting-strength-base":
    "スクワット・ベンチプレス・デッドリフト・プレス・パワークリーンを使い、ノービス期に適した線形漸進でバーベル筋力の基礎を築く。",
  "upper-lower-base":
    "上半身と下半身を交互に鍛える週4日プログラムで、全身の筋力とサイズを効率よく伸ばす。",
  "dumbbell-full-body-base":
    "ダンベルだけで全身を鍛えられる初心者向けプログラム。バーベルなしでも効果的に筋力と筋量を伸ばす。",
};

const PROGRAM_OVERVIEW_BY_SLUG: Record<string, string> = {
  "gzclp-base":
    "週3日でスクワット・ベンチプレス・デッドリフト・プレスをバランスよく鍛えるGZCLP基礎プログラムです。T1のメイン種目で重さを伸ばし、T2の補助種目でフォームと基礎筋力を固め、T3のアクセサリー種目で弱点補強を行います。バーベルトレーニングを始めたばかりの方に最適なプログラムです。",
  "gzclp-base-v2":
    "週3日で全身をしっかり鍛える改良版GZCLPプログラムです。T1のメイン種目で重さを伸ばし、T2の補助種目でフォームと基礎筋力を高め、T3のアクセサリー種目で弱点補強や筋肉量アップを狙います。種目の入れ替えに対応しており、バリエーションを持たせながら継続できます。",
  "gzclp-base-v2-4day":
    "週4回で全身をしっかり鍛えるGZCLPプログラムです。T1のメイン種目で重さを伸ばし、T2の補助種目でフォームと基礎筋力を高め、T3のアクセサリー種目で弱点補強や筋肉量アップを狙います。無理に重量を上げるのではなく、決められた回数を丁寧にこなしながら、少しずつ成長していく内容です。",
  "big3-2day":
    "スクワット・ベンチプレス・デッドリフトのみ使用する週2日プログラム。A（T1スクワット）/B（T1ベンチ）/C（T1デッドリフト）の3サイクルを順番に回し、各種目がT1・T2・T3を均等に担当します。T1は5×3+、T2は3×10、T3は3×15+。",
  "big3-3day":
    "スクワット・ベンチプレス・デッドリフトの3種目のみ使用する週3日プログラム。D1/D2/D3のローテーションで各種目が毎週T1・T2・T3を1回ずつ担当します。T1は5×3+、T2は3×10、T3は3×15+。",
  "big3-2day-6week":
    "BIG3の6通りの順列（A〜F）を週2日×6週で2周するプログラム。各種目がT1・T2・T3をそれぞれ4回ずつ均等に担当する完全対称設計。T1は5×3+、T2は3×10、T3は3×15+。週1・4=A/B、週2・5=C/D、週3・6=E/Fで固定サイクル。",
  "barbell-2day-base":
    "週2回だけジムに来られる初心者・再開者に最適な全身プログラム。スクワット・デッドリフト・ベンチプレス・オーバーヘッドプレス・バーベルローの5種目を使い、A日とB日の2パターンで全身をバランスよく鍛えます。",
  "starting-strength-base":
    "スクワット毎回・ベンチ/プレスを交互・デッドリフト/パワークリーンを交互に行うA/Bセッション構成。毎回重量を増やしながらバーベル筋力を着実に伸ばします。初心者向けの定番プログラムです。",
  "upper-lower-base":
    "上半身の日（ベンチプレス・バーベルロー・オーバーヘッドプレス）と下半身の日（スクワット・デッドリフト）を交互に行う週4日構成。各セッションでT1・T2を組み合わせて強度とボリュームをバランスよく確保します。",
  "dumbbell-full-body-base":
    "ダンベルを主な器具として使用する全身トレーニングプログラム。スクワット・デッドリフト・プレス系・ロー系をダンベルで行います。バーベルを使わずに基礎体力を高めたい方に最適です。",
};

/**
 * Returns the Japanese display title for a program.
 * Falls back to the original title if slug not found.
 */
export function formatProgramTitle(slug: string, title: string): string {
  return PROGRAM_TITLE_BY_SLUG[slug] ?? title;
}

/**
 * Returns the Japanese goal text for a program.
 * Falls back to the original value if slug not found or value is null.
 */
export function formatProgramGoal(slug: string, goal: string | null): string | null {
  return PROGRAM_GOAL_BY_SLUG[slug] ?? goal;
}

/**
 * Returns the Japanese overview text for a program.
 * Falls back to the original value if slug not found.
 */
export function formatProgramOverview(slug: string, overview: string): string {
  return PROGRAM_OVERVIEW_BY_SLUG[slug] ?? overview;
}

/**
 * Formats a week heading for display.
 * If the label is just "Week N" (redundant with weekNumber), it is suppressed.
 * Otherwise the label is appended after translation.
 */
export function formatProgramWeekLabel(weekNumber: number, label: string | null): string {
  const base = `${weekNumber}週目`;
  if (!label) return base;
  // Suppress "Week N" labels — they're redundant with the weekNumber display
  if (/^Week\s+\d+$/i.test(label.trim())) return base;
  // Translate any remaining Week/Day patterns and append
  const translated = formatWeekDay(label);
  return `${base} — ${translated}`;
}

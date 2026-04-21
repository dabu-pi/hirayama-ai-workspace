import type { ProgramCatalogItem, ProgramListItem } from "@/types/programs";

// Active program library (4 programs).
// Non-public programs (gzclp-base-v2, starting-strength-base, upper-lower-base,
// dumbbell-full-body-base, full-body-foundation) are hidden via is_public=false
// in the DB and excluded from this mock fallback.
const PROGRAM_CATALOG: ProgramCatalogItem[] = [
  {
    id: "program-gzclp",
    slug: "gzclp-base",
    title: "GZCLP Base",
    level: "Beginner",
    levelKey: "beginner",
    goal: "Build strength and size with the original GZCLP three-tier novice template.",
    frequencyLabel: "3 days / week",
    durationLabel: "4 weeks",
    sourceProgramName: "GZCLP",
    sourceFidelity: "original",
    sourceNotes:
      "Original Cody Lefever base month: A1 / B1 / A2 / B2 over 4 weeks with T1 / T2 / T3 progression.",
    tags: [],
    methodology: "gzcl",
    overview:
      "Original GZCLP base month with 5x3+ T1 work, 3x10 T2 practice, and 3x15+ T3 accessories."
  },
  {
    id: "program-gzclp-v2-4day",
    slug: "gzclp-base-v2-4day",
    title: "GZCLP 5-Exercise 4-Day",
    level: "Beginner",
    levelKey: "beginner",
    goal: "週4トレーニングで完全なA1/B1/A2/B2サイクルを毎週こなし、筋力と筋量を効率よく積み上げる。",
    frequencyLabel: "4 days / week",
    durationLabel: "4 weeks",
    sourceProgramName: "GZCLP",
    sourceFidelity: "adapted",
    sourceNotes:
      "gzclp-base-v2 をベースに週4版へ拡張。毎週 A1/B1/A2/B2 の完全サイクルを実施。T3候補は動作パターン別（スクワット系/ベンチ系/OHP系/デッドリフト系）に各3種から選択可能。",
    tags: [],
    methodology: "gzcl",
    overview:
      "完全な A1/B1/A2/B2 サイクルを毎週繰り返す週4版 GZCLP。各セッション: T1 メイン 5×3+、T2 練習 3×10、T3アクセサリー3種（固定プル種目 + 動作系統別の選択T3×2）。T3は主種目の動作パターン（スクワット/ベンチ/OHP/デッドリフト）に応じた3候補から交換可能。"
  },
  {
    id: "program-big3-3day",
    slug: "big3-3day",
    title: "BIG3 3-Day",
    level: "Beginner",
    levelKey: "beginner",
    goal: "スクワット・ベンチプレス・デッドリフトの3種目に集中し、基礎筋力を効率よく構築する。",
    frequencyLabel: "3 days / week",
    durationLabel: "4 weeks",
    sourceProgramName: null,
    sourceFidelity: "custom",
    sourceNotes:
      "BIG3のみの3種目ローテーション。T1/T2/T3を日替わりで割り当て、週3日で全種目を均等に強化する。",
    tags: [],
    methodology: "gzcl",
    overview:
      "スクワット・ベンチプレス・デッドリフトの3種目のみ使用する週3日プログラム。D1/D2/D3のローテーションで各種目が毎週T1・T2・T3を1回ずつ担当する。T1は5×3+、T2は3×10、T3は3×15+。"
  },
  {
    id: "program-big3-2day",
    slug: "big3-2day",
    title: "BIG3 2-Day",
    level: "Beginner",
    levelKey: "beginner",
    goal: "スクワット・ベンチプレス・デッドリフトの3種目で構成するローテーション型の週2日プログラム。",
    frequencyLabel: "2 days / week",
    durationLabel: "4 weeks",
    sourceProgramName: null,
    sourceFidelity: "custom",
    sourceNotes:
      "BIG3のみのA/B/C 3サイクルローテーション。各種目がT1/T2/T3を順番に担当する。",
    tags: [],
    methodology: "gzcl",
    overview:
      "スクワット・ベンチプレス・デッドリフトのみ使用する週2日プログラム。A（T1スクワット）/B（T1ベンチ）/C（T1デッドリフト）の3サイクルを順番に回し、各種目がT1・T2・T3を均等に担当する。T1は5×3+、T2は3×10、T3は3×15+。"
  }
];

export function listProgramCatalogItems(): ProgramCatalogItem[] {
  return PROGRAM_CATALOG.map((program) => ({ ...program }));
}

export function findProgramCatalogItemBySlug(
  programSlug: string
): ProgramCatalogItem | null {
  const program = PROGRAM_CATALOG.find((item) => item.slug === programSlug);
  return program ? { ...program } : null;
}

export function toProgramListItem(program: ProgramCatalogItem): ProgramListItem {
  const { overview: _overview, ...summary } = program;
  return summary;
}

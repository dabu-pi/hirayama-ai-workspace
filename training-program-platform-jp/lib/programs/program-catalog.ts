import type { ProgramCatalogItem, ProgramListItem } from "@/types/programs";

// Active program library (5 programs).
// Non-public programs (gzclp-base-v2, starting-strength-base, upper-lower-base,
// dumbbell-full-body-base, full-body-foundation) are hidden via is_public=false
// in the DB and excluded from this mock fallback.
const PROGRAM_CATALOG: ProgramCatalogItem[] = [
  {
    id: "program-gzclp",
    slug: "gzclp-base",
    title: "GZCLP 基礎プログラム",
    level: "初級",
    levelKey: "beginner",
    goal: "オリジナルGZCLPの3段階ノービステンプレートで筋力と筋量を伸ばす。",
    frequencyLabel: "3日/週",
    durationLabel: "4週間",
    sourceProgramName: "GZCLP",
    sourceFidelity: "original",
    sourceNotes:
      "Cody Lefever オリジナルベース月：4週間にわたりA1/B1/A2/B2を循環し、T1/T2/T3の漸進モデルで進める。",
    tags: [],
    methodology: "gzcl",
    overview:
      "T1メイン5×3+、T2練習3×10、T3アクセサリー3×15+で構成するGZCLPオリジナルベース月。"
  },
  {
    id: "program-gzclp-v2-4day",
    slug: "gzclp-base-v2-4day",
    title: "GZCLP 基礎 4日/週（4週）",
    level: "初級",
    levelKey: "beginner",
    goal: "週4トレーニングで完全なA1/B1/A2/B2サイクルを毎週こなし、筋力と筋量を効率よく積み上げる。",
    frequencyLabel: "4日/週",
    durationLabel: "4週間",
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
    title: "BIG3 3日/週（4週）",
    level: "初級",
    levelKey: "beginner",
    goal: "スクワット・ベンチプレス・デッドリフトの3種目に集中し、基礎筋力を効率よく構築する。",
    frequencyLabel: "3日/週",
    durationLabel: "4週間",
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
    title: "BIG3 2日/週（4週）",
    level: "初級",
    levelKey: "beginner",
    goal: "スクワット・ベンチプレス・デッドリフトの3種目で構成するローテーション型の週2日プログラム。",
    frequencyLabel: "2日/週",
    durationLabel: "4週間",
    sourceProgramName: null,
    sourceFidelity: "custom",
    sourceNotes:
      "BIG3のみのA/B/C 3サイクルローテーション。各種目がT1/T2/T3を順番に担当する。",
    tags: [],
    methodology: "gzcl",
    overview:
      "スクワット・ベンチプレス・デッドリフトのみ使用する週2日プログラム。A（T1スクワット）/B（T1ベンチ）/C（T1デッドリフト）の3サイクルを順番に回し、各種目がT1・T2・T3を均等に担当する。T1は5×3+、T2は3×10、T3は3×15+。"
  },
  {
    id: "program-big3-2day-6week",
    slug: "big3-2day-6week",
    title: "BIG3 2日/週（6週）",
    level: "初級",
    levelKey: "beginner",
    goal: "6週間でスクワット・ベンチプレス・デッドリフトの全種目がT1/T2/T3を均等に担当する、完全対称ローテーション型の週2日プログラム。",
    frequencyLabel: "2日/週",
    durationLabel: "6週間",
    sourceProgramName: null,
    sourceFidelity: "custom",
    sourceNotes:
      "BIG3の6通りの順列（A〜F）を2周し、各種目がT1/T2/T3をそれぞれ4回担当する完全対称設計。",
    tags: [],
    methodology: "gzcl",
    overview:
      "スクワット・ベンチプレス・デッドリフトの6通りの順列（A〜F）を週2日×6週で2周するプログラム。各種目がT1・T2・T3をそれぞれ4回ずつ均等に担当する完全対称設計。T1は5×3+、T2は3×10、T3は3×15+。週1・4=A/B、週2・5=C/D、週3・6=E/F で固定サイクル。"
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

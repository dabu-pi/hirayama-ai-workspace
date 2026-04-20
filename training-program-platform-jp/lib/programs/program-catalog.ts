import type { ProgramCatalogItem, ProgramListItem } from "@/types/programs";

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
    id: "program-gzclp-v2",
    slug: "gzclp-base-v2",
    title: "GZCLP 5-Exercise Base",
    level: "Beginner",
    levelKey: "beginner",
    goal: "Build strength and size with GZCLP's A1/B1/A2/B2 rotation, extended to 5 exercises per session.",
    frequencyLabel: "3 days / week",
    durationLabel: "4 weeks",
    sourceProgramName: "GZCLP",
    sourceFidelity: "adapted",
    sourceNotes:
      "Based on Cody Lefever's original GZCLP base month. Core T1/T2/T3 tier and A1/B1/A2/B2 rotation unchanged. Extended from 3 to 5 exercises per session by adding T1-support and T2-support T3 accessories.",
    tags: [],
    methodology: "gzcl",
    overview:
      "GZCLP's original four-day rotating structure (A1/B1/A2/B2) with 5×3+ T1 work, 3×10 T2 practice, and three T3 accessories per session: a fixed pull slot plus T1-support and T2-support movements."
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
    id: "program-starting-strength-phase2",
    slug: "starting-strength-base",
    title: "Starting Strength Phase 2 Base",
    level: "Beginner",
    levelKey: "beginner",
    goal: "Build novice barbell strength with squat-every-session A/B training.",
    frequencyLabel: "3 days / week",
    durationLabel: "3 weeks",
    sourceProgramName: "Starting Strength Novice Program - Phase 2",
    sourceFidelity: "original",
    sourceNotes:
      "Phase 2 snapshot: squat every session, bench and press alternate, deadlift on A, power clean on B.",
    tags: [],
    methodology: "linear",
    overview:
      "Official Starting Strength Phase 2 structure packaged as a short seedable base while keeping the current route slug."
  },
  {
    id: "program-upper-lower",
    slug: "upper-lower-base",
    title: "Upper Lower Base",
    level: "Intermediate",
    levelKey: "intermediate",
    goal: "Build barbell strength with a simple upper/lower split.",
    frequencyLabel: "4 days / week",
    durationLabel: "4 weeks",
    sourceProgramName: null,
    sourceFidelity: "custom",
    sourceNotes:
      "Internal MVP upper/lower template. No single canonical source program is being represented.",
    tags: [],
    methodology: "gzcl",
    overview:
      "Custom four-day upper/lower barbell split for MVP coverage. Treated as custom rather than as a named published program."
  },
  {
    id: "program-dumbbell-full-body",
    slug: "dumbbell-full-body-base",
    title: "Dumbbell Full Body Base",
    level: "Beginner",
    levelKey: "beginner",
    goal: "Build full-body fitness with dumbbells — no barbell required.",
    frequencyLabel: "3 days / week",
    durationLabel: "4 weeks",
    sourceProgramName: null,
    sourceFidelity: "custom",
    sourceNotes:
      "Internal beginner dumbbell full-body template. No single canonical source program is being represented.",
    tags: [],
    methodology: "generic",
    overview:
      "A beginner-friendly full-body routine built entirely around dumbbells. Each session covers lower body, upper push, and upper pull movements. Alternating A/B structure keeps variety across the week."
  },
  {
    id: "program-full-body",
    slug: "full-body-foundation",
    title: "Full Body Foundation",
    level: "Beginner",
    levelKey: "beginner",
    goal: "Create a repeatable full-body rhythm with lower session complexity.",
    frequencyLabel: "3 days / week",
    durationLabel: "6 weeks",
    sourceProgramName: null,
    sourceFidelity: "custom",
    sourceNotes: "Internal placeholder program in the mock catalog.",
    tags: [],
    methodology: "generic",
    overview:
      "A lower-complexity full-body plan designed to build consistency, movement familiarity, and recoverable weekly volume."
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

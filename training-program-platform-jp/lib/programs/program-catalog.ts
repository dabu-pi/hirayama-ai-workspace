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
    overview:
      "Original GZCLP base month with 5x3+ T1 work, 3x10 T2 practice, and 3x15+ T3 accessories."
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

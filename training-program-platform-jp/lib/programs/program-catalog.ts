import type { ProgramCatalogItem, ProgramListItem } from "@/types/programs";

const PROGRAM_CATALOG: ProgramCatalogItem[] = [
  {
    id: "program-gzclp",
    slug: "gzclp-base",
    title: "GZCLP Base",
    level: "Beginner",
    levelKey: "beginner",
    goal: "Build the main barbell lifts with simple weekly progression.",
    frequencyLabel: "4 days / week",
    durationLabel: "12 weeks",
    tags: [],
    overview:
      "A simple linear progression template centered on squat, bench, press, and deadlift with steady weekly exposure."
  },
  {
    id: "program-upper-lower",
    slug: "upper-lower-base",
    title: "Upper Lower Base",
    level: "Intermediate",
    levelKey: "intermediate",
    goal: "上半身・下半身に分割した週4回の中級バーベルプログラム。",
    frequencyLabel: "4 days / week",
    durationLabel: "4 weeks",
    tags: [],
    overview:
      "ベンチ・プレス・ロウを上半身日に、スクワット・デッドリフトを下半身日に集中させる。"
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

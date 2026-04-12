import type { ProgramListItem } from "@/types/programs";

export const PROGRAM_CATALOG: ProgramListItem[] = [
  {
    id: "program-gzclp",
    slug: "gzclp-base",
    title: "GZCLP Base",
    level: "Beginner",
    goal: "Build the main barbell lifts with simple weekly progression.",
    frequencyLabel: "4 days / week",
    durationLabel: "12 weeks"
  },
  {
    id: "program-upper-lower",
    slug: "upper-lower-strength",
    title: "Upper / Lower Strength",
    level: "Intermediate",
    goal: "Balance squat, hinge, press, and pull volume through the week.",
    frequencyLabel: "4 days / week",
    durationLabel: "8 weeks"
  },
  {
    id: "program-full-body",
    slug: "full-body-foundation",
    title: "Full Body Foundation",
    level: "Beginner",
    goal: "Create a repeatable full-body rhythm with lower session complexity.",
    frequencyLabel: "3 days / week",
    durationLabel: "6 weeks"
  }
];

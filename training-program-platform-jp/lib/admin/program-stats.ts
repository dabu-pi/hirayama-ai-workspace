import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type ProgramStatRow = {
  programId: string;
  slug: string;
  title: string;
  level: string | null;
  totalEnrollments: number;
  activeCount: number;
  completedCount: number;
  pausedCount: number;
  lastEnrolledAt: string | null;
};

type EnrollmentRow = {
  program_id: string;
  status: string;
  started_at: string;
  // archived_at is included to correctly classify "利用中":
  // an enrollment can have status='active' AND archived_at IS NOT NULL (user pressed 終了).
  archived_at: string | null;
};

type ProgramRow = {
  id: string;
  slug: string;
  title: string;
  level: string | null;
};

/**
 * Aggregates program_enrollments by program — no personal data included.
 * Results sorted by totalEnrollments descending (most popular first).
 *
 * activeCount counts ONLY non-archived active enrollments
 * (status='active' AND archived_at IS NULL), mirroring how active-program.ts
 * resolves the "currently in use" enrollment shown in /train.
 */
export async function getProgramStats(): Promise<ProgramStatRow[]> {
  const admin = createSupabaseAdminClient();

  const [enrollmentsResult, programsResult] = await Promise.all([
    admin
      .from("program_enrollments")
      .select("program_id, status, started_at, archived_at"),
    admin
      .from("programs")
      .select("id, slug, title, level")
      .eq("is_public", true)
      .order("title", { ascending: true })
  ]);

  if (programsResult.error) {
    console.error("getProgramStats: programs query failed.", programsResult.error.message);
    return [];
  }

  const programs = (programsResult.data ?? []) as ProgramRow[];
  const enrollments = (enrollmentsResult.data ?? []) as EnrollmentRow[];

  // Aggregate enrollments per program in memory (gym scale: safe)
  type Agg = { total: number; active: number; completed: number; paused: number; lastAt: string | null };
  const agg = new Map<string, Agg>();

  for (const program of programs) {
    agg.set(program.id, { total: 0, active: 0, completed: 0, paused: 0, lastAt: null });
  }

  for (const e of enrollments) {
    const entry = agg.get(e.program_id);
    if (!entry) continue;
    entry.total++;
    // "利用中" = active AND not archived.
    // archived_at IS NOT NULL means the user ended this enrollment from /programs.
    if (e.status === "active" && e.archived_at === null) entry.active++;
    else if (e.status === "completed") entry.completed++;
    else if (e.status === "paused") entry.paused++;
    if (!entry.lastAt || e.started_at > entry.lastAt) entry.lastAt = e.started_at;
  }

  const rows: ProgramStatRow[] = programs.map((p) => {
    const a = agg.get(p.id)!;
    return {
      programId: p.id,
      slug: p.slug,
      title: p.title,
      level: p.level,
      totalEnrollments: a.total,
      activeCount: a.active,
      completedCount: a.completed,
      pausedCount: a.paused,
      lastEnrolledAt: a.lastAt
    };
  });

  return rows.sort((a, b) => b.totalEnrollments - a.totalEnrollments);
}

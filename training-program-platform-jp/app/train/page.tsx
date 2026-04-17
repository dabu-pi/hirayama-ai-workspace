import { BlockedSessionScreen } from "@/components/train/BlockedSessionScreen";
import { StartSessionScreen } from "@/components/workout/StartSessionScreen";
import { WorkoutScreen } from "@/components/workout/WorkoutScreen";
import { getMockWorkoutSession } from "@/lib/mock/workout";
import { getActiveProgramView } from "@/lib/workout/active-program";
import { getProgramDayLabel } from "@/lib/workout/start-session";
import { resolveTrainingEntry } from "@/lib/workout/train-entry";
import { getTrainProgramSelection } from "@/lib/workout/train-selection";
import {
  findWorkoutSessionByDayId,
  getCurrentWorkoutSessionView
} from "@/lib/workout/train-session";

export const dynamic = "force-dynamic";

type TrainPageProps = {
  searchParams?: {
    program?: string | string[];
    programDayId?: string | string[];
  };
};

export default async function TrainPage({ searchParams }: TrainPageProps) {
  const selectedProgram = await getTrainProgramSelection(
    searchParams?.program,
    searchParams?.programDayId
  );

  // programDayId が渡されている場合: セッション状態を解決してから処理する
  if (
    selectedProgram.state === "selected" &&
    selectedProgram.programDayId &&
    selectedProgram.programSlug &&
    selectedProgram.programTitle
  ) {
    // S-3: Resolve entry mode before attempting to start/resume.
    // - 'blocked'  → same enrollment has a different day in progress; show warning.
    // - 'resume'   → in-progress session exists for this exact day; load it.
    // - 'start'    → no in-progress session; show start confirmation.
    // - 'invalid'  → resolver failed (unauthenticated / env missing); fall through
    //               to existing session lookup for graceful degradation.
    const entry = await resolveTrainingEntry(selectedProgram.programDayId);

    if (entry.mode === "blocked") {
      return (
        <BlockedSessionScreen
          programSlug={selectedProgram.programSlug}
          programTitle={selectedProgram.programTitle}
          blockedByDayLabel={entry.blockedByDayLabel}
          blockedByProgramDayId={entry.blockedByProgramDayId}
        />
      );
    }

    // For 'resume', 'start', and 'invalid' — proceed with the existing
    // session lookup. findWorkoutSessionByDayId returns the in-progress
    // session for this day (resume) or null (start), so the conditional
    // below handles both correctly.
    const [existingSession, programDayLabel] = await Promise.all([
      findWorkoutSessionByDayId(selectedProgram.programDayId),
      getProgramDayLabel(selectedProgram.programDayId)
    ]);

    if (!existingSession) {
      return (
        <StartSessionScreen
          programDayId={selectedProgram.programDayId}
          programDayLabel={programDayLabel}
          programSlug={selectedProgram.programSlug}
          programTitle={selectedProgram.programTitle}
        />
      );
    }

    // 既存 in_progress セッションがあればそのまま WorkoutScreen へ
    return <WorkoutScreen selectedProgram={selectedProgram} session={existingSession} />;
  }

  // programDayId なし（クエリなし / invalid）: 従来どおり現在セッションを表示
  const session = await getCurrentWorkoutSessionView();
  if (session) {
    return <WorkoutScreen selectedProgram={selectedProgram} session={session} />;
  }

  const { views, isAuthenticated } = await getActiveProgramView();
  const primaryView = views[0] ?? null;

  if (
    isAuthenticated &&
    primaryView?.actionType === "start" &&
    primaryView.currentProgramDayId &&
    primaryView.programSlug
  ) {
    return (
      <StartSessionScreen
        programDayId={primaryView.currentProgramDayId}
        programDayLabel={primaryView.currentWeekDayLabel || "Current Workout"}
        programSlug={primaryView.programSlug}
        programTitle={primaryView.programTitle}
      />
    );
  }

  return (
    <WorkoutScreen
      selectedProgram={selectedProgram}
      session={getMockWorkoutSession()}
    />
  );
}

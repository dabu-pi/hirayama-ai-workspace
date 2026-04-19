import { redirect } from "next/navigation";

import { BlockedSessionScreen } from "@/components/train/BlockedSessionScreen";
import { TrainAuthRequired } from "@/components/train/TrainAuthRequired";
import { StartSessionScreen } from "@/components/workout/StartSessionScreen";
import { WorkoutScreen } from "@/components/workout/WorkoutScreen";
import { getActiveProgramView } from "@/lib/workout/active-program";
import { getProgramDayLabel } from "@/lib/workout/start-session";
import { resolveTrainingEntry } from "@/lib/workout/train-entry";
import { getAuthenticatedWorkoutUserId } from "@/lib/workout/session-access";
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

/** Cause categories emitted to Vercel runtime log for redirect diagnosis. */
type RedirectCause =
  | "no_selected_program"
  | "no_program_day"
  | "no_actionable_enrollment"
  | "no_current_session"
  | "unexpected_fallback";

export default async function TrainPage({ searchParams }: TrainPageProps) {
  const PAGE = "train-page";

  // Auth gate: unauthenticated users get a login prompt regardless of URL params.
  const userId = await getAuthenticatedWorkoutUserId();
  if (!userId) {
    console.info(`${PAGE}:branch`, { branch: "unauthenticated" });
    return <TrainAuthRequired />;
  }

  const selectedProgram = await getTrainProgramSelection(
    searchParams?.program,
    searchParams?.programDayId
  );

  console.info(`${PAGE}:selected_program`, {
    userId,
    state: selectedProgram.state,
    programSlug: selectedProgram.programSlug,
    programTitle: selectedProgram.programTitle,
    programDayId: selectedProgram.programDayId,
    source: selectedProgram.source,
    rawProgramParam: Array.isArray(searchParams?.program)
      ? searchParams?.program[0]
      : (searchParams?.program ?? null),
    rawProgramDayIdParam: Array.isArray(searchParams?.programDayId)
      ? searchParams?.programDayId[0]
      : (searchParams?.programDayId ?? null)
  });

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

    console.info(`${PAGE}:train_entry`, {
      userId,
      programDayId: selectedProgram.programDayId,
      entryMode: entry.mode,
      entryReason: entry.reason,
      sessionId: entry.sessionId,
      blockedByProgramDayId: entry.blockedByProgramDayId
    });

    if (entry.mode === "blocked") {
      console.info(`${PAGE}:branch`, { branch: "blocked", programDayId: selectedProgram.programDayId });
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

    console.info(`${PAGE}:existing_session`, {
      userId,
      programDayId: selectedProgram.programDayId,
      found: Boolean(existingSession),
      sessionId: existingSession?.id ?? null,
      sessionStatus: existingSession?.status ?? null,
      entryMode: entry.mode
    });

    if (!existingSession) {
      console.info(`${PAGE}:branch`, { branch: "start_session_screen", programDayId: selectedProgram.programDayId });
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
    console.info(`${PAGE}:branch`, { branch: "workout_screen_from_day", sessionId: existingSession.id });
    return <WorkoutScreen selectedProgram={selectedProgram} session={existingSession} />;
  }

  // programDayId なし（クエリなし / invalid）: 従来どおり現在セッションを表示
  const session = await getCurrentWorkoutSessionView();

  console.info(`${PAGE}:current_session`, {
    userId,
    selectedProgramState: selectedProgram.state,
    found: Boolean(session),
    sessionId: session?.id ?? null,
    sessionStatus: session?.status ?? null
  });

  if (session) {
    console.info(`${PAGE}:branch`, { branch: "workout_screen_from_current", sessionId: session.id });
    return <WorkoutScreen selectedProgram={selectedProgram} session={session} />;
  }

  const { views, isAuthenticated } = await getActiveProgramView();
  const primaryView = views[0] ?? null;

  console.info(`${PAGE}:active_program`, {
    userId,
    isAuthenticated,
    viewCount: views.length,
    primaryViewActionType: primaryView?.actionType ?? null,
    primaryViewCurrentProgramDayId: primaryView?.currentProgramDayId ?? null,
    primaryViewProgramSlug: primaryView?.programSlug ?? null,
    primaryViewEnrollmentId: primaryView?.enrollmentId ?? null,
    primaryViewActiveSessionId: primaryView?.activeSessionId ?? null,
    // enrollmentId list for multi-enrollment debugging
    allActionTypes: views.map((v) => ({ enrollmentId: v.enrollmentId, actionType: v.actionType, currentProgramDayId: v.currentProgramDayId }))
  });

  if (
    isAuthenticated &&
    primaryView?.actionType === "start" &&
    primaryView.currentProgramDayId &&
    primaryView.programSlug
  ) {
    console.info(`${PAGE}:branch`, {
      branch: "start_session_screen_from_enrollment",
      programDayId: primaryView.currentProgramDayId,
      programSlug: primaryView.programSlug
    });
    return (
      <StartSessionScreen
        programDayId={primaryView.currentProgramDayId}
        programDayLabel={primaryView.currentWeekDayLabel || "Current Workout"}
        programSlug={primaryView.programSlug}
        programTitle={primaryView.programTitle}
      />
    );
  }

  // S-12: resume path when getCurrentWorkoutSessionView returned null but the
  // active-program view still reports an in-progress session. This happens when
  // selectCurrentInProgressSession and selectInProgressSessionsForEnrollments
  // temporarily disagree (e.g. archived_at filter difference, race condition).
  // Redirect to continueUrl which carries programDayId → resolveTrainingEntry
  // will find the session and load WorkoutScreen correctly.
  if (isAuthenticated && primaryView?.actionType === "resume" && primaryView.continueUrl) {
    console.info(`${PAGE}:branch`, {
      branch: "redirect_resume_via_continue_url",
      enrollmentId: primaryView.enrollmentId,
      continueUrl: primaryView.continueUrl,
      activeSessionId: primaryView.activeSessionId
    });
    redirect(primaryView.continueUrl);
  }

  // Determine redirect cause for log correlation
  const redirectCause: RedirectCause = (() => {
    if (selectedProgram.state === "none") return "no_selected_program";
    if (selectedProgram.state === "selected" && !selectedProgram.programDayId) {
      return "no_program_day";
    }
    if (!isAuthenticated || !primaryView) return "no_actionable_enrollment";
    if (!session) return "no_current_session";
    return "unexpected_fallback";
  })();

  console.warn(`${PAGE}:redirect_to_programs`, {
    userId,
    cause: redirectCause,
    selectedProgramState: selectedProgram.state,
    selectedProgramDayId: selectedProgram.programDayId,
    isAuthenticated,
    viewCount: views.length,
    primaryViewActionType: primaryView?.actionType ?? null,
    primaryViewCurrentProgramDayId: primaryView?.currentProgramDayId ?? null,
    primaryViewProgramSlug: primaryView?.programSlug ?? null,
    primaryViewActiveSessionId: primaryView?.activeSessionId ?? null,
    currentSessionFound: Boolean(session)
  });

  // Authenticated but no active session and no enrollment with an actionable day.
  // Previously this rendered a mock WorkoutSession (id = "session-demo-20260411").
  // That id is not a UUID, so pressing Cancel/Finish hit PostgREST with a 400
  // 22P02 (invalid_text_representation) which surfaced as a 500 response.
  // Route the user to the program picker instead.
  redirect("/programs");
}

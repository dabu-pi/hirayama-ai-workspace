import { redirect } from "next/navigation";

import { BlockedSessionScreen } from "@/components/train/BlockedSessionScreen";
import { MembershipRequiredScreen } from "@/components/train/MembershipRequiredScreen";
import { TrainAuthRequired } from "@/components/train/TrainAuthRequired";
import { StartSessionScreen } from "@/components/workout/StartSessionScreen";
import { WorkoutScreen } from "@/components/workout/WorkoutScreen";
import { getActiveProgramView } from "@/lib/workout/active-program";
import { getMembershipStatus } from "@/lib/workout/membership";
import { getProgramDayLabel } from "@/lib/workout/start-session";
import { resolveTrainingEntry } from "@/lib/workout/train-entry";
import { getAuthenticatedWorkoutUserId } from "@/lib/workout/session-access";
import { getTrainFallbackView } from "@/lib/workout/enrollment";
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
    debug?: string | string[];
  };
};

/** Cause categories emitted to Vercel runtime log for redirect diagnosis. */
type RedirectCause =
  | "no_active_enrollment"
  | "no_program_day"
  | "no_actionable_enrollment"
  | "no_current_session"
  | "start_missing_slug"
  | "unexpected_fallback";

export default async function TrainPage({ searchParams }: TrainPageProps) {
  const PAGE = "train-page";
  const tPage = Date.now();

  // Auth gate: unauthenticated users get a login prompt regardless of URL params.
  const tAuth = Date.now();
  const userId = await getAuthenticatedWorkoutUserId();
  console.info(`${PAGE}:perf`, { step: "auth", ms: Date.now() - tAuth, userId: Boolean(userId) });
  if (!userId) {
    console.info(`${PAGE}:branch`, { branch: "unauthenticated" });
    return <TrainAuthRequired />;
  }

  // Membership gate + program selection run in parallel:
  // getTrainProgramSelection depends only on searchParams (no userId, no membership).
  // Fails open (null) on DB error to avoid blocking legitimate users.
  const tMembershipAndSelection = Date.now();
  const [membershipStatus, selectedProgram] = await Promise.all([
    getMembershipStatus(userId),
    getTrainProgramSelection(searchParams?.program, searchParams?.programDayId)
  ]);
  console.info(`${PAGE}:perf`, {
    step: "membership+programSelection",
    ms: Date.now() - tMembershipAndSelection,
    membershipStatus,
    selectedProgramState: selectedProgram.state
  });

  if (membershipStatus !== null && membershipStatus !== "active") {
    console.info(`${PAGE}:branch`, { branch: "membership_required", status: membershipStatus });
    return <MembershipRequiredScreen />;
  }

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
    // S-3 speculative parallel: resolveTrainingEntry and findWorkoutSessionByDayId have
    // no data dependency on each other — run all three concurrently.
    //
    // resume path benefit: resolveTrainingEntry's 4-query sequential chain (~800ms at
    // 200ms/rtt) previously blocked loadSessionView (~1200ms). Running in parallel
    // reduces server render time from ~2000ms to ~1200ms (saves ~800ms).
    //
    // blocked path: existingSession result is simply discarded (findWorkoutSessionByDayId
    // returns null for a different-day blocking session, so the wasted work is minimal).
    // start path: findWorkoutSessionByDayId returns null after 1 cheap query; no
    // loadSessionView is invoked, so the overhead is ~1 extra round-trip within the
    // parallel window — no net latency cost.
    const tParallel = Date.now();
    const [entry, existingSession, programDayLabel] = await Promise.all([
      resolveTrainingEntry(selectedProgram.programDayId),
      findWorkoutSessionByDayId(selectedProgram.programDayId),
      getProgramDayLabel(selectedProgram.programDayId)
    ]);
    console.info(`${PAGE}:perf`, {
      step: "Promise.all(entry+session+label)",
      ms: Date.now() - tParallel,
      entryMode: entry.mode,
      sessionFound: Boolean(existingSession),
      programDayId: selectedProgram.programDayId
    });

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
  const tCurrentSession = Date.now();
  const session = await getCurrentWorkoutSessionView();
  console.info(`${PAGE}:perf`, { step: "getCurrentWorkoutSessionView", ms: Date.now() - tCurrentSession, found: Boolean(session) });

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

  const tActiveProgram = Date.now();
  const { views, isAuthenticated, resolutionSnapshot } = await getActiveProgramView({ forTrain: true });
  console.info(`${PAGE}:perf`, { step: "getActiveProgramView", ms: Date.now() - tActiveProgram, viewCount: views.length });
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
    primaryView.currentProgramDayId
    // Note: programSlug is intentionally NOT required here. selectProgramsBatch
    // silently returns [] on error (RLS / query failure), leaving programSlug="".
    // An empty slug still allows StartSessionScreen to function: the session
    // starts correctly and post-start navigation uses getCurrentWorkoutSessionView.
    // Only the "Back to Program" link degrades (links to /programs generically).
  ) {
    console.info(`${PAGE}:branch`, {
      branch: "start_session_screen_from_enrollment",
      programDayId: primaryView.currentProgramDayId,
      programSlug: primaryView.programSlug || "(empty)"
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
  //
  // Guard: only redirect when programSlug is non-empty. If programSlug="",
  // continueUrl becomes "/train?program=&programDayId=…" which normalises to
  // state:"none" and falls back to the naked path — causing an infinite loop.
  // With an empty slug, fall through to redirect("/programs") instead.
  if (
    isAuthenticated &&
    primaryView?.actionType === "resume" &&
    primaryView.continueUrl &&
    primaryView.programSlug
  ) {
    console.info(`${PAGE}:branch`, {
      branch: "redirect_resume_via_continue_url",
      enrollmentId: primaryView.enrollmentId,
      continueUrl: primaryView.continueUrl,
      activeSessionId: primaryView.activeSessionId
    });
    redirect(primaryView.continueUrl);
  }

  // Fallback: getActiveProgramView returned no views (query failure or no enrollment
  // found) OR the primary view has actionType="none" (current_program_day_id is null).
  // Attempt a lightweight direct enrollment lookup to recover training context.
  // Only runs when no other branch already redirected or returned a screen.
  if (isAuthenticated && (!primaryView || primaryView.actionType === "none")) {
    const fallback = await getTrainFallbackView(userId);
    if (fallback) {
      console.info(`${PAGE}:branch`, {
        branch: "fallback_redirect_via_enrollment",
        programSlug: fallback.programSlug,
        programDayId: fallback.programDayId,
        hadPrimaryView: Boolean(primaryView),
        primaryViewActionType: primaryView?.actionType ?? null
      });
      redirect(`/train?program=${fallback.programSlug}&programDayId=${fallback.programDayId}`);
    }
  }

  // Determine redirect cause for log correlation
  const redirectCause: RedirectCause = (() => {
    if (selectedProgram.state === "none") return "no_active_enrollment";
    if (selectedProgram.state === "selected" && !selectedProgram.programDayId) {
      return "no_program_day";
    }
    if (!isAuthenticated || !primaryView) return "no_actionable_enrollment";
    // actionType=start with currentProgramDayId set but programSlug="" — selectProgramsBatch
    // failed silently; this should no longer redirect (handled above) but log if reached.
    if (primaryView?.actionType === "start" && primaryView.currentProgramDayId && !primaryView.programSlug) {
      return "start_missing_slug";
    }
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

  // Debug overlay: navigate to /train?debug=train to see resolved state in-browser
  // without requiring Vercel log access. Remove once the issue is diagnosed.
  const debugParam = Array.isArray(searchParams?.debug)
    ? searchParams?.debug[0]
    : searchParams?.debug;
  if (debugParam === "train" && isAuthenticated) {
    const debugPayload = {
      selectedProgramState: selectedProgram.state,
      selectedProgramSlug: selectedProgram.programSlug,
      selectedProgramDayId: selectedProgram.programDayId,
      currentSessionFound: Boolean(session),
      isAuthenticated,
      viewCount: views.length,
      primaryViewActionType: primaryView?.actionType ?? null,
      primaryViewCurrentProgramDayId: primaryView?.currentProgramDayId ?? null,
      primaryViewProgramSlug: primaryView?.programSlug ?? null,
      primaryViewContinueUrl: primaryView?.continueUrl ?? null,
      primaryViewActiveSessionId: primaryView?.activeSessionId ?? null,
      redirectCause,
      resolutionSnapshot: resolutionSnapshot ?? null
    };
    console.warn(`${PAGE}:debug_overlay`, debugPayload);
    return (
      <main style={{ padding: "1rem", fontFamily: "monospace" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
          /train debug — cause: {redirectCause}
        </h2>
        <pre style={{ fontSize: "0.75rem", whiteSpace: "pre-wrap", background: "#f4f4f4", padding: "0.5rem" }}>
          {JSON.stringify(debugPayload, null, 2)}
        </pre>
        <p style={{ fontSize: "0.75rem", color: "#666", marginTop: "0.5rem" }}>
          Remove ?debug=train to proceed normally.
        </p>
      </main>
    );
  }

  console.info(`${PAGE}:perf`, { step: "TOTAL_to_redirect", ms: Date.now() - tPage });
  // Authenticated but no active session and no enrollment with an actionable day.
  // Previously this rendered a mock WorkoutSession (id = "session-demo-20260411").
  // That id is not a UUID, so pressing Cancel/Finish hit PostgREST with a 400
  // 22P02 (invalid_text_representation) which surfaced as a 500 response.
  // Route the user to the program picker instead.
  redirect("/programs");
}

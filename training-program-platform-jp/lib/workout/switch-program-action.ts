"use server";

import { getAuthenticatedWorkoutContext } from "@/lib/workout/session-access";
import { switchActiveProgram } from "@/lib/workout/enrollment";
import type { SwitchProgramResult } from "@/lib/workout/enrollment";

/**
 * Server Action: atomically switches the user's active program enrollment.
 * Called from ProgramSwitchButton (Client Component) after user confirms.
 *
 * On success: returns ok=true and a nextTrainUrl to navigate to.
 * On failure: returns ok=false with an error code.
 */
export async function switchProgramAction(
  targetProgramId: string
): Promise<SwitchProgramResult> {
  const { userId } = await getAuthenticatedWorkoutContext();
  if (!userId) {
    return { ok: false, nextTrainUrl: null, error: "unauthenticated" };
  }
  return await switchActiveProgram(userId, targetProgramId);
}

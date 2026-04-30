"use client";

import { useTransition } from "react";

import { switchProgramAction } from "@/lib/workout/switch-program-action";

type Props = {
  targetProgramId: string;
  currentProgramTitle: string;
  className?: string;
  children?: React.ReactNode;
};

/**
 * Program switch CTA.
 * Shows a confirmation dialog, then calls switchProgramAction (Server Action)
 * to atomically pause the current enrollment and activate the new one,
 * before navigating to the correct next workout URL.
 *
 * Using a Server Action (instead of just navigating to /train?program=X)
 * ensures the enrollment switch is committed to the DB before the user
 * reaches the Train page — no risk of race conditions or wrong active enrollment.
 */
export function ProgramSwitchButton({ targetProgramId, currentProgramTitle, className, children }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const ok = window.confirm(
      `現在「${currentProgramTitle}」を進行中です。\n` +
      `別のプログラムに切り替えると、現在の進行は一時停止されます。\n\n` +
      `新しいプログラムに切り替えますか？`
    );
    if (!ok) return;

    startTransition(async () => {
      const result = await switchProgramAction(targetProgramId);
      // Navigate to the next workout URL for the newly activated enrollment.
      // window.location.assign bypasses the Next.js Router Cache so /train
      // always renders fresh after the enrollment switch.
      window.location.assign(result.ok && result.nextTrainUrl ? result.nextTrainUrl : "/train");
    });
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleClick}
      className={className}
    >
      {isPending ? "切り替え中..." : (children ?? "このプログラムへ切り替える")}
    </button>
  );
}

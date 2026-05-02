"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { RestartProgramResponse } from "@/types/workout";

type RestartProgramButtonProps = {
  programId: string;
  className?: string;
  children?: React.ReactNode;
};

/**
 * S-7: Restart Program button.
 *
 * Posts to /api/programs/:programId/restart. The endpoint is idempotent —
 * if an active enrollment already exists for this program, it is reused
 * instead of creating a duplicate. On success, navigates to Home so the
 * user can see the freshly active enrollment card.
 *
 * In-flight clicks are blocked by `isBusy` (either local state or the
 * router transition), preventing a second request from firing while the
 * first is pending.
 */
export function RestartProgramButton({
  programId,
  className,
  children
}: RestartProgramButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBusy = isSubmitting || isPending;

  async function handleClick() {
    if (isBusy) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/programs/${encodeURIComponent(programId)}/restart`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        }
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setError(
          body.error?.message ??
            "プログラムの再開に失敗しました。もう一度お試しください。"
        );
        setIsSubmitting(false);
        return;
      }

      const body = (await response.json()) as RestartProgramResponse;
      const redirectUrl = body.redirectUrl || "/";

      startTransition(() => {
        router.push(redirectUrl);
        router.refresh();
      });
    } catch {
      setError("ネットワークエラーが発生しました。接続を確認してもう一度お試しください。");
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        className={className}
        disabled={isBusy}
        onClick={handleClick}
        type="button"
      >
        {isBusy ? "再開中..." : children ?? "プログラムを最初から"}
      </button>
      {error && (
        <p
          role="alert"
          style={{
            color: "#ef4444",
            fontSize: "0.875rem",
            marginTop: "0.5rem"
          }}
        >
          {error}
        </p>
      )}
    </>
  );
}

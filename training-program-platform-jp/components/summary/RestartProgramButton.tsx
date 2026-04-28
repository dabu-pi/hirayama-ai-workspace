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
            "Failed to restart program. Please try again."
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
      setError("Network error. Please check your connection and try again.");
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
        {isBusy ? "Restarting…" : children ?? "Restart Program"}
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import styles from "./ArchiveSessionButton.module.css";

type Props = {
  sessionId: string;
};

export function ArchiveSessionButton({ sessionId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleArchive() {
    if (
      !window.confirm(
        "このセッションをアーカイブしますか？\n非表示になりますが、データは保持されます。"
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/workout-sessions/${sessionId}/archive`, {
        method: "POST"
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      className={styles.archiveBtn}
      disabled={loading}
      onClick={handleArchive}
      type="button"
    >
      {loading ? "…" : "Archive"}
    </button>
  );
}

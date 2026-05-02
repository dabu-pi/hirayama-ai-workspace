"use client";

import { useState } from "react";

import styles from "./CustomWorkoutButton.module.css";

export function CustomWorkoutButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClick = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/workout-sessions/custom", {
        method: "POST"
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const msg =
          payload?.error?.message ?? "セッションの作成に失敗しました。";
        setErrorMessage(msg);
        return;
      }

      // router.push("/train") はNext.js 14 Router Cacheの古いエントリを
      // 再生するため、window.location.assign でRouter Cacheをバイパスする。
      window.location.assign("/train");
    } catch {
      setErrorMessage("ネットワークエラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <button
        className={styles.button}
        disabled={isLoading}
        onClick={handleClick}
        type="button"
      >
        {isLoading ? "準備中..." : "自由に作成"}
      </button>
      {errorMessage ? (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

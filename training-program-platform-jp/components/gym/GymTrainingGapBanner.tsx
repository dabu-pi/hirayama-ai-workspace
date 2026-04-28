"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import styles from "./GymScreen.module.css";

// Mirrors TrainingGapInfo in GymScreen.tsx
type TrainingGapInfo = {
  daysLabel: string;
  message: string;
  level: "none" | "good" | "ok" | "warn" | "alert";
};

type Props = {
  trainingGap: TrainingGapInfo;
  /** true when the user has at least one past session (level !== "none") */
  showCta: boolean;
};

export function GymTrainingGapBanner({ trainingGap, showCta }: Props) {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    // iOS Safari uses non-standard navigator.standalone
    const iosStandalone =
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(mq.matches || iosStandalone);
  }, []);

  const levelClass = styles[`trainingGap_${trainingGap.level}` as keyof typeof styles];

  return (
    <div
      className={[
        styles.trainingGap,
        levelClass,
        isStandalone ? styles.trainingGap_standalone : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {isStandalone && (
        <p className={styles.trainingGapPwaLabel}>ホーム画面から起動中</p>
      )}
      {trainingGap.daysLabel && (
        <p className={styles.trainingGapDays}>{trainingGap.daysLabel}</p>
      )}
      <p className={styles.trainingGapMessage}>{trainingGap.message}</p>
      {isStandalone && showCta && (
        <Link href="/train" className={styles.trainingGapCta}>
          トレーニングを始める →
        </Link>
      )}
    </div>
  );
}

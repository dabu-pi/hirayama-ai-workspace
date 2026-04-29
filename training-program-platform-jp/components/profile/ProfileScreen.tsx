"use client";

import { useState, useTransition } from "react";

import { updateOwnDisplayName } from "@/app/profile/actions";
import { submitPauseRequest } from "@/app/profile/pause-actions";
import type { OwnPauseRequest } from "@/app/profile/pause-actions";

import styles from "./ProfileScreen.module.css";

type StatusLevel = "active" | "pending" | "paused" | "cancelled";

function getMembershipStatusDisplay(
  status: string | null,
  hasPendingPause: boolean
): { label: string; level: StatusLevel } {
  if (status === "cancelled") return { label: "退会済み", level: "cancelled" };
  if (status === "paused")    return { label: "休会中", level: "paused" };
  if (hasPendingPause)        return { label: "休会申請中（承認待ち）", level: "pending" };
  return { label: "会員（利用中）", level: "active" };
}

type ProfileScreenProps = {
  email: string | null;
  initialDisplayName: string | null;
  membershipStatus: string | null;
  pendingPauseRequest: OwnPauseRequest | null;
};

export function ProfileScreen({
  email,
  initialDisplayName,
  membershipStatus,
  pendingPauseRequest,
}: ProfileScreenProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Pause request state
  const [hasPausePending, setHasPausePending] = useState(pendingPauseRequest !== null);
  const [pauseReason, setPauseReason] = useState("");
  const [pauseConfirmMode, setPauseConfirmMode] = useState(false);
  const [pauseFeedback, setPauseFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPausePending, startPauseTransition] = useTransition();

  function handlePauseSubmit() {
    if (!pauseConfirmMode) {
      setPauseConfirmMode(true);
      return;
    }
    setPauseFeedback(null);
    startPauseTransition(async () => {
      const result = await submitPauseRequest(pauseReason || null);
      if (result.ok) {
        setHasPausePending(true);
        setPauseConfirmMode(false);
        setPauseFeedback({
          ok: true,
          message: result.billingMessage ?? "休会申請を受け付けました。"
        });
      } else if (result.error === "already_pending") {
        setHasPausePending(true);
        setPauseFeedback({ ok: false, message: "休会申請は既に受付済みです。" });
      } else if (result.error === "already_paused") {
        setPauseFeedback({ ok: false, message: "すでに休会中です。" });
      } else {
        setPauseFeedback({ ok: false, message: result.error ?? "申請に失敗しました。" });
      }
    });
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const result = await updateOwnDisplayName(displayName);
      if (result.ok) {
        setFeedback({ ok: true, message: "表示名を保存しました。" });
        setTimeout(() => setFeedback(null), 3000);
      } else {
        setFeedback({ ok: false, message: result.error ?? "保存に失敗しました。" });
      }
    });
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>プロフィール</h1>
        <p className={styles.description}>アプリ上で表示される名前を変更できます。</p>
      </header>

      <form className={styles.form} onSubmit={handleSave}>
        <div className={styles.field}>
          <span className={styles.label}>メールアドレス</span>
          <p className={styles.staticValue}>{email ?? "—"}</p>
        </div>

        {(() => {
          const { label, level } = getMembershipStatusDisplay(membershipStatus, hasPausePending);
          return (
            <div className={styles.field}>
              <span className={styles.label}>会員ステータス</span>
              <span className={`${styles.statusBadge} ${styles[`status_${level}`]}`}>{label}</span>
              {level === "pending" && pendingPauseRequest?.effective_from && (
                <p className={styles.hint}>
                  休会開始予定日: {pendingPauseRequest.effective_from.replace(/-(\d+)-(\d+)$/, "年$1月$2日")}
                </p>
              )}
            </div>
          );
        })()}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="display-name">
            表示名
          </label>
          <input
            id="display-name"
            className={styles.input}
            disabled={isPending}
            maxLength={50}
            placeholder="例: 山田 太郎"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <p className={styles.hint}>
            表示名はアプリ内で表示される名前です。会員登録情報とは別に管理されます。
          </p>
        </div>

        {feedback && (
          <p
            className={`${styles.feedback} ${
              feedback.ok ? styles.feedbackOk : styles.feedbackError
            }`}
          >
            {feedback.ok ? "✓ " : "✗ "}
            {feedback.message}
          </p>
        )}

        <button className={styles.saveButton} disabled={isPending} type="submit">
          {isPending ? "保存中…" : "保存する"}
        </button>
      </form>

      <nav className={styles.links}>
        <a className={styles.linkItem} href="/my-exercises">
          マイ種目（カスタム種目の管理）→
        </a>
      </nav>

      {/* M-B: Pause request section */}
      {membershipStatus !== "cancelled" && (
        <section className={styles.deletionSection}>
          <h2 className={styles.deletionTitle}>休会申請</h2>

          {membershipStatus === "paused" ? (
            <div className={styles.deletionPendingCard}>
              <p className={styles.deletionPendingText}>
                現在、休会中です。再開をご希望の場合はスタッフまでご連絡ください。
              </p>
            </div>
          ) : hasPausePending ? (
            <div className={styles.deletionPendingCard}>
              <p className={styles.deletionPendingText}>
                休会申請は受付済みです。スタッフ確認後に手続きを進めます。
              </p>
            </div>
          ) : (
            <>
              <p className={styles.deletionDescription}>
                休会をご希望の場合は、こちらから申請できます。
                申請後、スタッフが確認のうえ開始日をご連絡いたします。
                翌月分の口座振替データが確定済みの場合、翌々月からの適用となります。
              </p>
              <div className={styles.deletionForm}>
                <label className={styles.label} htmlFor="pause-reason">
                  申請理由（任意）
                </label>
                <textarea
                  id="pause-reason"
                  className={styles.deletionTextarea}
                  disabled={isPausePending}
                  maxLength={500}
                  placeholder="理由をご記入ください（任意）"
                  rows={3}
                  value={pauseReason}
                  onChange={(e) => { setPauseReason(e.target.value); setPauseConfirmMode(false); }}
                />
                {pauseConfirmMode && (
                  <p className={styles.deletionConfirmText}>
                    本当に休会申請を送信しますか？もう一度ボタンを押すと申請されます。
                  </p>
                )}
                <button
                  className={pauseConfirmMode ? styles.deletionConfirmButton : styles.deletionButton}
                  disabled={isPausePending}
                  type="button"
                  onClick={handlePauseSubmit}
                >
                  {isPausePending ? "送信中..." : pauseConfirmMode ? "申請を確定する" : "休会を申請する"}
                </button>
              </div>
            </>
          )}

          {pauseFeedback && (
            <p className={pauseFeedback.ok ? styles.feedbackOk : styles.feedbackError}>
              {pauseFeedback.message}
            </p>
          )}
        </section>
      )}

      {/* 退会: アプリ申請は停止中。窓口で受付 */}
      <section className={styles.deletionSection}>
        <h2 className={styles.deletionTitle}>退会について</h2>
        <div className={styles.deletionPendingCard}>
          <p className={styles.deletionPendingText}>
            退会をご希望の場合は、受付までお申し出ください。
            {membershipStatus === "cancelled" && (
              <> このアカウントはすでに退会済みです。再入会をご希望の場合もスタッフまでご連絡ください。</>
            )}
          </p>
        </div>
      </section>
    </main>
  );
}

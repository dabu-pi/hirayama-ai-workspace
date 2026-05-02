"use client";

import { useState, useTransition } from "react";

import {
  cancelDeletionRequest,
  submitDeletionRequest,
  updateOwnDisplayName
} from "@/app/profile/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import styles from "./ProfileScreen.module.css";

const DELETION_CONFIRM_WORD = "申請する";

type StatusLevel = "active" | "paused" | "cancelled";

function getMembershipStatusDisplay(
  status: string | null
): { label: string; level: StatusLevel } {
  if (status === "cancelled") return { label: "退会済み", level: "cancelled" };
  if (status === "paused")    return { label: "休会中",  level: "paused" };
  return { label: "会員（利用中）", level: "active" };
}

type DeletionRequestSnapshot = {
  id: string;
  status: string;
  requested_at: string;
} | null;

type ProfileScreenProps = {
  email: string | null;
  initialDisplayName: string | null;
  membershipStatus: string | null;
  latestDeletionRequest: DeletionRequestSnapshot;
};

export function ProfileScreen({
  email,
  initialDisplayName,
  membershipStatus,
  latestDeletionRequest,
}: ProfileScreenProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Deletion request state
  const [deletionRequest, setDeletionRequest] = useState<DeletionRequestSnapshot>(
    latestDeletionRequest
  );
  const [delReason, setDelReason] = useState("");
  const [delConfirmText, setDelConfirmText] = useState("");
  const [isSubmittingDel, setIsSubmittingDel] = useState(false);
  const [submitDelError, setSubmitDelError] = useState<string | null>(null);
  const [isCancellingDel, setIsCancellingDel] = useState(false);
  const [cancelDelError, setCancelDelError] = useState<string | null>(null);

  async function handleSubmitDeletion(e: React.FormEvent) {
    e.preventDefault();
    if (delConfirmText !== DELETION_CONFIRM_WORD) return;
    if (isSubmittingDel) return;

    setIsSubmittingDel(true);
    setSubmitDelError(null);

    const result = await submitDeletionRequest(delReason);

    if (result.ok && result.requestId) {
      setDeletionRequest({
        id: result.requestId,
        status: "pending",
        requested_at: new Date().toISOString()
      });
      setDelReason("");
      setDelConfirmText("");
    } else {
      const msg =
        result.error === "pending_exists"
          ? "すでに申請中のリクエストがあります。"
          : "申請に失敗しました。もう一度お試しください。";
      setSubmitDelError(msg);
    }

    setIsSubmittingDel(false);
  }

  async function handleCancelDeletion() {
    if (!deletionRequest || deletionRequest.status !== "pending") return;
    if (!window.confirm("申請を取り消しますか？")) return;
    if (isCancellingDel) return;

    setIsCancellingDel(true);
    setCancelDelError(null);

    const result = await cancelDeletionRequest(deletionRequest.id);

    if (result.ok) {
      setDeletionRequest({ ...deletionRequest, status: "cancelled_by_user" });
    } else {
      setCancelDelError("取り消しに失敗しました。もう一度お試しください。");
    }

    setIsCancellingDel(false);
  }

  async function handleLogout() {
    if (!window.confirm("ログアウトしますか？")) return;
    if (isLoggingOut) return;

    setIsLoggingOut(true);

    try {
      await createSupabaseBrowserClient().auth.signOut();
    } catch {
      // signOut failed — navigate to /login anyway to reset UI state
    }

    window.location.href = "/login";
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

  const { label, level } = getMembershipStatusDisplay(membershipStatus);

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

        <div className={styles.field}>
          <span className={styles.label}>会員ステータス</span>
          <span className={`${styles.statusBadge} ${styles[`status_${level}`]}`}>{label}</span>
        </div>

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

      <section className={styles.accountSection}>
        <h2 className={styles.accountTitle}>アカウント</h2>
        <p className={styles.accountDescription}>
          この端末からログアウトします。再度利用する場合は、ログインが必要です。
        </p>
        <button
          className={styles.logoutButton}
          disabled={isLoggingOut}
          onClick={handleLogout}
          type="button"
        >
          {isLoggingOut ? "ログアウト中…" : "ログアウト"}
        </button>
      </section>

      {/* S-4: Account deletion request */}
      <section className={styles.deletionReqSection}>
        <h2 className={styles.deletionReqTitle}>アカウント削除申請</h2>

        <div className={styles.deletionReqWarning}>
          <p className={styles.deletionReqWarningText}>
            この操作は、トレーニングアプリのアカウント削除申請です。
            ジムの会員契約・会費・休会・退会手続きは、この申請だけでは完了しません。
            退会・休会・会費に関するお手続きは、受付までお申し出ください。
          </p>
        </div>

        {/* pending */}
        {deletionRequest?.status === "pending" && (
          <div className={styles.deletionReqStatusCard}>
            <p className={styles.deletionReqStatusText}>
              アカウント削除申請を受付済みです。管理者の確認をお待ちください。
            </p>
            {cancelDelError && (
              <p className={styles.deletionReqError}>{cancelDelError}</p>
            )}
            <button
              className={styles.deletionReqCancelButton}
              disabled={isCancellingDel}
              type="button"
              onClick={handleCancelDeletion}
            >
              {isCancellingDel ? "取り消し中…" : "申請を取り消す"}
            </button>
          </div>
        )}

        {/* approved */}
        {deletionRequest?.status === "approved" && (
          <div className={styles.deletionReqStatusCard}>
            <p className={styles.deletionReqStatusText}>
              アカウント削除申請は承認済みです。アプリ利用や会員契約に関する確認は受付までお問い合わせください。
            </p>
          </div>
        )}

        {/* rejected */}
        {deletionRequest?.status === "rejected" && (
          <div className={styles.deletionReqStatusCard}>
            <p className={styles.deletionReqStatusText}>
              以前のアカウント削除申請は確認の結果、承認されませんでした。必要な場合は受付までお問い合わせください。
            </p>
          </div>
        )}

        {/* null / cancelled_by_user → show form */}
        {(!deletionRequest || deletionRequest.status === "cancelled_by_user") && (
          <form className={styles.deletionReqForm} onSubmit={handleSubmitDeletion}>
            {deletionRequest?.status === "cancelled_by_user" && (
              <p className={styles.deletionReqNote}>
                以前のアカウント削除申請は取り消されています。
              </p>
            )}
            <p className={styles.deletionReqHint}>
              申請後、管理者が内容を確認します。確認が完了するまで、通常どおりログインできる場合があります。
            </p>

            <div className={styles.deletionReqField}>
              <label className={styles.deletionReqLabel} htmlFor="deletion-reason">
                削除申請の理由（任意）
              </label>
              <textarea
                id="deletion-reason"
                className={styles.deletionReqTextarea}
                disabled={isSubmittingDel}
                maxLength={500}
                placeholder="例：アプリを使わなくなったため"
                rows={2}
                value={delReason}
                onChange={(e) => setDelReason(e.target.value)}
              />
            </div>

            <div className={styles.deletionReqField}>
              <label className={styles.deletionReqLabel} htmlFor="deletion-confirm">
                確認のため「申請する」と入力してください
              </label>
              <input
                id="deletion-confirm"
                className={styles.deletionReqConfirmInput}
                disabled={isSubmittingDel}
                placeholder="申請する"
                type="text"
                value={delConfirmText}
                onChange={(e) => setDelConfirmText(e.target.value)}
              />
            </div>

            {submitDelError && (
              <p className={styles.deletionReqError}>{submitDelError}</p>
            )}

            <button
              className={styles.deletionReqSubmitButton}
              disabled={isSubmittingDel || delConfirmText !== DELETION_CONFIRM_WORD}
              type="submit"
            >
              {isSubmittingDel ? "申請中…" : "アカウント削除を申請する"}
            </button>
          </form>
        )}
      </section>

      {/* 休会・退会: アプリ申請は停止中。受付で対応 */}
      <section className={styles.deletionSection}>
        <h2 className={styles.deletionTitle}>休会・退会について</h2>
        <div className={styles.deletionPendingCard}>
          <p className={styles.deletionPendingText}>
            休会・退会をご希望の場合は、受付までお申し出ください。
            口座振替の確定状況、休会開始月、再開時の充当についてスタッフよりご案内いたします。
            {membershipStatus === "cancelled" && (
              <> このアカウントはすでに退会済みです。再入会をご希望の場合もスタッフまでご連絡ください。</>
            )}
          </p>
        </div>
      </section>
    </main>
  );
}

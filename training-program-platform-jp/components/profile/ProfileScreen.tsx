"use client";

import { useState, useTransition } from "react";

import { selfDeleteAccount, updateOwnDisplayName } from "@/app/profile/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import styles from "./ProfileScreen.module.css";

const SELF_DELETE_CONFIRM_WORD = "アカウントを削除します";

type StatusLevel = "active" | "paused" | "cancelled";

function getMembershipStatusDisplay(
  status: string | null
): { label: string; level: StatusLevel } {
  if (status === "cancelled") return { label: "退会済み", level: "cancelled" };
  if (status === "paused")    return { label: "休会中",  level: "paused" };
  return { label: "会員（利用中）", level: "active" };
}

type ProfileScreenProps = {
  email: string | null;
  initialDisplayName: string | null;
  membershipStatus: string | null;
};

export function ProfileScreen({
  email,
  initialDisplayName,
  membershipStatus,
}: ProfileScreenProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Self-delete state
  const [selfDelChecks, setSelfDelChecks] = useState({
    notGymExit: false,
    noAppAccess: false,
    noRestore: false
  });
  const [selfDelConfirmText, setSelfDelConfirmText] = useState("");
  const [selfDelReason, setSelfDelReason] = useState("");
  const [isSelfDeleting, setIsSelfDeleting] = useState(false);
  const [selfDelError, setSelfDelError] = useState<string | null>(null);

  const allChecked =
    selfDelChecks.notGymExit &&
    selfDelChecks.noAppAccess &&
    selfDelChecks.noRestore;
  const canSelfDelete =
    allChecked &&
    selfDelConfirmText === SELF_DELETE_CONFIRM_WORD &&
    !isSelfDeleting;

  function toggleSelfDelCheck(key: keyof typeof selfDelChecks) {
    setSelfDelChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSelfDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!canSelfDelete) return;

    setIsSelfDeleting(true);
    setSelfDelError(null);

    const result = await selfDeleteAccount({
      confirmText: selfDelConfirmText,
      reason: selfDelReason
    });

    if (result.ok) {
      try {
        await createSupabaseBrowserClient().auth.signOut();
      } catch {
        // signOut failure is non-critical — navigate away regardless
      }
      window.location.href = "/account-deleted";
      return;
    }

    setSelfDelError("アカウント削除に失敗しました。時間をおいて再度お試しください。");
    setIsSelfDeleting(false);
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

      {/* S-7: Self-service account deletion */}
      <section className={styles.selfDeleteSection}>
        <h2 className={styles.selfDeleteTitle}>トレーニングアプリのアカウント削除</h2>

        <div className={styles.selfDeleteNotice}>
          <p className={styles.selfDeleteNoticeText}>
            この操作は、トレーニングアプリのアカウント削除です。
            ジムの会員契約・会費・休会・退会手続きは、この操作だけでは完了しません。
            退会・休会・会費に関する手続きは、受付までお申し出ください。
          </p>
        </div>

        <p className={styles.selfDeleteDescription}>
          削除を実行すると、このアプリにはログインして利用できなくなります。
          トレーニング履歴や登録情報はアプリ上で確認できなくなります。
          削除後の復元はできません。
        </p>

        <form className={styles.selfDeleteForm} onSubmit={handleSelfDelete}>
          <div className={styles.selfDeleteChecklist}>
            <label className={styles.selfDeleteCheckItem}>
              <input
                className={styles.selfDeleteCheckbox}
                checked={selfDelChecks.notGymExit}
                disabled={isSelfDeleting}
                type="checkbox"
                onChange={() => toggleSelfDelCheck("notGymExit")}
              />
              <span className={styles.selfDeleteCheckLabel}>
                この操作はジム退会ではないことを理解しました
              </span>
            </label>
            <label className={styles.selfDeleteCheckItem}>
              <input
                className={styles.selfDeleteCheckbox}
                checked={selfDelChecks.noAppAccess}
                disabled={isSelfDeleting}
                type="checkbox"
                onChange={() => toggleSelfDelCheck("noAppAccess")}
              />
              <span className={styles.selfDeleteCheckLabel}>
                削除後、このアプリを利用できなくなることを理解しました
              </span>
            </label>
            <label className={styles.selfDeleteCheckItem}>
              <input
                className={styles.selfDeleteCheckbox}
                checked={selfDelChecks.noRestore}
                disabled={isSelfDeleting}
                type="checkbox"
                onChange={() => toggleSelfDelCheck("noRestore")}
              />
              <span className={styles.selfDeleteCheckLabel}>
                削除後の復元ができないことを理解しました
              </span>
            </label>
          </div>

          <div className={styles.selfDeleteField}>
            <label className={styles.selfDeleteLabel} htmlFor="self-del-reason">
              削除の理由（任意）
            </label>
            <textarea
              id="self-del-reason"
              className={styles.selfDeleteReasonTextarea}
              disabled={isSelfDeleting}
              maxLength={500}
              placeholder="例：アプリを使わなくなったため"
              rows={2}
              value={selfDelReason}
              onChange={(e) => setSelfDelReason(e.target.value)}
            />
          </div>

          <div className={styles.selfDeleteField}>
            <label className={styles.selfDeleteLabel} htmlFor="self-del-confirm">
              確認のため「アカウントを削除します」と入力してください
            </label>
            <input
              id="self-del-confirm"
              className={styles.selfDeleteConfirmInput}
              disabled={isSelfDeleting}
              placeholder="アカウントを削除します"
              type="text"
              value={selfDelConfirmText}
              onChange={(e) => setSelfDelConfirmText(e.target.value)}
            />
          </div>

          {selfDelError && (
            <p className={styles.selfDeleteError}>{selfDelError}</p>
          )}

          <button
            className={styles.selfDeleteSubmitButton}
            disabled={!canSelfDelete}
            type="submit"
          >
            {isSelfDeleting ? "削除中…" : "アカウントを削除する"}
          </button>
        </form>
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

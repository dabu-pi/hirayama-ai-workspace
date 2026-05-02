"use client";

import { useState, useTransition } from "react";

import { updateOwnDisplayName } from "@/app/profile/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import styles from "./ProfileScreen.module.css";

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

"use client";

import { useState, useTransition } from "react";

import { updateOwnDisplayName } from "@/app/profile/actions";
import { submitDeletionRequest } from "@/app/profile/deletion-actions";
import type { OwnDeletionRequest } from "@/app/profile/deletion-actions";

import styles from "./ProfileScreen.module.css";

type ProfileScreenProps = {
  email: string | null;
  initialDisplayName: string | null;
  pendingDeletionRequest: OwnDeletionRequest | null;
};

export function ProfileScreen({
  email,
  initialDisplayName,
  pendingDeletionRequest,
}: ProfileScreenProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Deletion request state
  const [hasPending, setHasPending] = useState(pendingDeletionRequest !== null);
  const [deletionReason, setDeletionReason] = useState("");
  const [confirmMode, setConfirmMode] = useState(false);
  const [deletionFeedback, setDeletionFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [isDeletionPending, startDeletionTransition] = useTransition();

  function handleDeletionSubmit() {
    if (!confirmMode) {
      setConfirmMode(true);
      return;
    }
    setDeletionFeedback(null);
    startDeletionTransition(async () => {
      const result = await submitDeletionRequest(deletionReason || null);
      if (result.ok) {
        setHasPending(true);
        setConfirmMode(false);
        setDeletionFeedback({
          ok: true,
          message: "退会申請を受け付けました。スタッフ確認後に手続きを進めます。",
        });
      } else if (result.error === "already_pending") {
        setHasPending(true);
        setDeletionFeedback({
          ok: false,
          message: "退会申請は既に受付済みです。",
        });
      } else {
        setDeletionFeedback({
          ok: false,
          message: result.error ?? "申請に失敗しました。",
        });
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

      {/* D-1: Account deletion request section */}
      <section className={styles.deletionSection}>
        <h2 className={styles.deletionTitle}>退会・アカウント削除申請</h2>

        {hasPending ? (
          <div className={styles.deletionPendingCard}>
            <p className={styles.deletionPendingText}>
              退会申請は受付済みです。スタッフ確認後に手続きを進めます。
            </p>
          </div>
        ) : (
          <>
            <p className={styles.deletionDescription}>
              退会をご希望の場合は、こちらから申請できます。
              申請後、スタッフが確認のうえ手続きを進めます。
              トレーニング履歴や会員情報の扱いについて確認が必要な場合があります。
            </p>
            <div className={styles.deletionForm}>
              <label className={styles.label} htmlFor="deletion-reason">
                申請理由（任意）
              </label>
              <textarea
                id="deletion-reason"
                className={styles.deletionTextarea}
                disabled={isDeletionPending}
                maxLength={500}
                placeholder="理由をご記入ください（任意）"
                rows={3}
                value={deletionReason}
                onChange={(e) => {
                  setDeletionReason(e.target.value);
                  setConfirmMode(false);
                }}
              />
              {confirmMode && (
                <p className={styles.deletionConfirmText}>
                  本当に退会申請を送信しますか？もう一度ボタンを押すと申請されます。
                </p>
              )}
              <button
                className={confirmMode ? styles.deletionConfirmButton : styles.deletionButton}
                disabled={isDeletionPending}
                type="button"
                onClick={handleDeletionSubmit}
              >
                {isDeletionPending
                  ? "送信中..."
                  : confirmMode
                  ? "申請を確定する"
                  : "退会を申請する"}
              </button>
              {!confirmMode && (
                <p className={styles.deletionNote}>
                  ご不明な点があれば、スタッフまでお気軽にお問い合わせください。
                </p>
              )}
            </div>
          </>
        )}

        {deletionFeedback && (
          <p
            className={
              deletionFeedback.ok ? styles.feedbackOk : styles.feedbackError
            }
          >
            {deletionFeedback.message}
          </p>
        )}
      </section>
    </main>
  );
}

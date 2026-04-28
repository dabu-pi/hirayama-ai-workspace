"use client";

import { useState, useTransition } from "react";

import {
  approveDeletionRequest,
  rejectDeletionRequest,
} from "@/app/admin/account-deletion-requests/actions";

import styles from "./DeletionRequestsScreen.module.css";

export type DeletionRequestItem = {
  id: string;
  userId: string;
  reason: string | null;
  status: string;
  requestedAt: string;
  reviewedAt: string | null;
  adminNote: string | null;
  email: string | null;
  memberName: string | null;
  displayName: string | null;
  membershipStatus: string;
};

type RequestCardProps = {
  request: DeletionRequestItem;
  onDone: (id: string, newStatus: "approved" | "rejected") => void;
};

function RequestCard({ request: r, onDone }: RequestCardProps) {
  const [adminNote, setAdminNote] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const isPendingStatus = r.status === "pending";

  function handleApprove() {
    startTransition(async () => {
      const result = await approveDeletionRequest(r.id, r.userId, adminNote);
      if (result.ok) {
        setFeedback({ ok: true, message: "承認しました。membership_status を cancelled に変更しました。" });
        onDone(r.id, "approved");
      } else {
        setFeedback({ ok: false, message: result.error ?? "承認に失敗しました。" });
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectDeletionRequest(r.id, adminNote);
      if (result.ok) {
        setFeedback({ ok: true, message: "却下しました。membership_status は変更していません。" });
        onDone(r.id, "rejected");
      } else {
        setFeedback({ ok: false, message: result.error ?? "却下に失敗しました。" });
      }
    });
  }

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={[styles.statusBadge, styles[`status_${r.status}`]].join(" ")}>
          {r.status}
        </span>
        <span className={styles.requestedAt}>{r.requestedAt.slice(0, 16).replace("T", " ")}</span>
      </div>

      <dl className={styles.fields}>
        <dt>メールアドレス</dt>
        <dd>{r.email ?? "—"}</dd>
        <dt>会員名</dt>
        <dd>{r.memberName ?? "（未設定）"}</dd>
        <dt>表示名</dt>
        <dd>{r.displayName ?? "（未設定）"}</dd>
        <dt>現在の会員ステータス</dt>
        <dd>{r.membershipStatus}</dd>
        <dt>申請理由</dt>
        <dd>{r.reason || "（未入力）"}</dd>
        {r.reviewedAt && (
          <>
            <dt>対応日時</dt>
            <dd>{r.reviewedAt.slice(0, 16).replace("T", " ")}</dd>
          </>
        )}
        {r.adminNote && (
          <>
            <dt>管理メモ</dt>
            <dd>{r.adminNote}</dd>
          </>
        )}
      </dl>

      {isPendingStatus && (
        <div className={styles.actions}>
          <p className={styles.disclaimer}>
            この処理ではログイン情報やトレーニング履歴は削除されません。退会後のデータは原則1年間保管し、1年経過後に削除対象として扱います。
          </p>
          <div className={styles.noteField}>
            <label className={styles.noteLabel} htmlFor={`note-${r.id}`}>
              管理メモ（任意）
            </label>
            <textarea
              id={`note-${r.id}`}
              className={styles.noteInput}
              disabled={isPending}
              maxLength={500}
              placeholder="内部記録用メモ"
              rows={2}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
            />
          </div>
          <div className={styles.buttons}>
            <button
              className={styles.approveButton}
              disabled={isPending}
              type="button"
              onClick={handleApprove}
            >
              {isPending ? "処理中..." : "承認して退会済みにする"}
            </button>
            <button
              className={styles.rejectButton}
              disabled={isPending}
              type="button"
              onClick={handleReject}
            >
              却下する
            </button>
          </div>
          {feedback && (
            <p className={feedback.ok ? styles.feedbackOk : styles.feedbackError}>
              {feedback.message}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

type Props = {
  requests: DeletionRequestItem[];
};

export function DeletionRequestsScreen({ requests: initialRequests }: Props) {
  const [requests, setRequests] = useState(initialRequests);

  function handleDone(id: string, newStatus: "approved" | "rejected") {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    );
  }

  const pending = requests.filter((r) => r.status === "pending");
  const others = requests.filter((r) => r.status !== "pending");

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.backLink} href="/admin">← 管理メニュー</a>
        <h1 className={styles.title}>退会申請管理</h1>
        <p className={styles.subtitle}>
          承認すると会員ステータスが「cancelled（退会済み）」になります。
          ログイン情報・トレーニング履歴はこの処理では削除されません。
          退会後のデータは確認・問い合わせ対応のため原則1年間保管し、1年経過後に削除対象として扱います。
        </p>
      </header>

      {pending.length === 0 && others.length === 0 && (
        <p className={styles.empty}>退会申請はありません。</p>
      )}

      {pending.length > 0 && (
        <section>
          <h2 className={styles.sectionTitle}>未処理 ({pending.length}件)</h2>
          {pending.map((r) => (
            <RequestCard key={r.id} request={r} onDone={handleDone} />
          ))}
        </section>
      )}

      {others.length > 0 && (
        <section className={styles.historySection}>
          <h2 className={styles.sectionTitle}>処理済み</h2>
          {others.map((r) => (
            <RequestCard key={r.id} request={r} onDone={handleDone} />
          ))}
        </section>
      )}
    </main>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { approvePauseRequest, rejectPauseRequest } from "@/app/admin/pause-requests/actions";
import styles from "./PauseRequestsScreen.module.css";

type PauseRequest = {
  id: string;
  userId: string;
  reason: string | null;
  status: string;
  nextMonthBillingConfirmed: boolean;
  effectiveFrom: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  adminNote: string | null;
  email: string | null;
  memberName: string | null;
  displayName: string | null;
  membershipStatus: string;
};

type Props = {
  requests: PauseRequest[];
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatEffectiveFrom(dateStr: string | null) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "申請中",
  approved: "承認済",
  rejected: "却下",
  cancelled_by_user: "取消済"
};

const STATUS_CLASS: Record<string, string> = {
  pending: "statusPending",
  approved: "statusApproved",
  rejected: "statusRejected",
  cancelled_by_user: "statusCancelled"
};

function RequestCard({ req }: { req: PauseRequest }) {
  const [adminNote, setAdminNote] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    if (!confirm(`${req.memberName ?? req.displayName ?? req.email ?? req.userId} の休会申請を承認しますか？`)) return;
    startTransition(async () => {
      const result = await approvePauseRequest(req.id, adminNote);
      setFeedback(result.ok ? "✅ 承認しました" : `エラー: ${result.error}`);
    });
  }

  function handleReject() {
    if (!confirm("却下しますか？")) return;
    startTransition(async () => {
      const result = await rejectPauseRequest(req.id, adminNote);
      setFeedback(result.ok ? "却下しました" : `エラー: ${result.error}`);
    });
  }

  const statusClass = STATUS_CLASS[req.status] ?? "statusPending";

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.memberInfo}>
          <span className={styles.memberName}>
            {req.memberName ?? req.displayName ?? "（名前未設定）"}
          </span>
          <span className={styles.memberEmail}>{req.email ?? "—"}</span>
        </div>
        <span className={`${styles.statusBadge} ${styles[statusClass]}`}>
          {STATUS_LABEL[req.status] ?? req.status}
        </span>
      </div>

      <dl className={styles.meta}>
        <dt>申請日時</dt><dd>{formatDate(req.requestedAt)}</dd>
        <dt>休会開始予定</dt>
        <dd>
          {formatEffectiveFrom(req.effectiveFrom)}
          {req.nextMonthBillingConfirmed && (
            <span className={styles.billingBadge}>翌月分引落済・充当あり</span>
          )}
        </dd>
        {req.reason && <><dt>申請理由</dt><dd>{req.reason}</dd></>}
        {req.reviewedAt && <><dt>処理日時</dt><dd>{formatDate(req.reviewedAt)}</dd></>}
        {req.adminNote && <><dt>管理者メモ</dt><dd>{req.adminNote}</dd></>}
        <dt>現在のステータス</dt><dd>{req.membershipStatus}</dd>
      </dl>

      {req.status === "pending" && (
        <div className={styles.actions}>
          <input
            className={styles.noteInput}
            placeholder="管理者メモ（任意）"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            disabled={isPending}
          />
          <div className={styles.buttons}>
            <button className={styles.approveBtn} onClick={handleApprove} disabled={isPending}>
              {isPending ? "処理中..." : "承認する"}
            </button>
            <button className={styles.rejectBtn} onClick={handleReject} disabled={isPending}>
              却下する
            </button>
          </div>
        </div>
      )}

      {feedback && <p className={styles.feedback}>{feedback}</p>}
    </div>
  );
}

export function PauseRequestsScreen({ requests }: Props) {
  const pending = requests.filter((r) => r.status === "pending");
  const others  = requests.filter((r) => r.status !== "pending");

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/admin" className={styles.back}>← 管理メニュー</Link>
        <h1 className={styles.title}>休会申請管理</h1>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          申請中 {pending.length > 0 && <span className={styles.badge}>{pending.length}</span>}
        </h2>
        {pending.length === 0
          ? <p className={styles.empty}>申請中の休会申請はありません。</p>
          : pending.map((r) => <RequestCard key={r.id} req={r} />)
        }
      </section>

      {others.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>処理済み</h2>
          {others.map((r) => <RequestCard key={r.id} req={r} />)}
        </section>
      )}
    </main>
  );
}

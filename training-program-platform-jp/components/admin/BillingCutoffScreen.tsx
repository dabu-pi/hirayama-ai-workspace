"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import type { BillingCutoffRecord } from "@/lib/admin/billing";
import {
  confirmNextMonthBilling,
  deleteBillingCutoff
} from "@/app/admin/billing/actions";
import styles from "./BillingCutoffScreen.module.css";

type Props = {
  nextMonthLabel: string;   // 例: "2026年5月"
  isConfirmed: boolean;
  history: BillingCutoffRecord[];
};

export function BillingCutoffScreen({ nextMonthLabel, isConfirmed, history }: Props) {
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setFeedback(null);
    startTransition(async () => {
      const result = await confirmNextMonthBilling(note);
      if (result.ok) {
        setNote("");
        setFeedback({ type: "ok", message: `${nextMonthLabel}の口座振替データを確定しました。` });
      } else if (result.alreadyExists) {
        setFeedback({ type: "error", message: "すでに確定済みです。" });
      } else {
        setFeedback({ type: "error", message: `エラー: ${result.error}` });
      }
    });
  }

  function handleDelete(id: string, label: string) {
    if (!confirm(`${label}の確定を取り消しますか？\n取り消すと、休会・退会申請の有効日判定に影響します。`)) return;
    startTransition(async () => {
      const result = await deleteBillingCutoff(id);
      if (!result.ok) {
        setFeedback({ type: "error", message: `削除エラー: ${result.error}` });
      } else {
        setFeedback({ type: "ok", message: "確定を取り消しました。" });
      }
    });
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/admin" className={styles.back}>← 管理メニュー</Link>
        <h1 className={styles.title}>口座振替確定管理</h1>
        <p className={styles.subtitle}>
          翌月分の口座振替データが確定したら、このページで記録してください。
          休会・退会申請の有効日計算に使用されます。
        </p>
      </header>

      {/* 翌月ステータス */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>翌月（{nextMonthLabel}）の状態</h2>
        <div className={`${styles.statusCard} ${isConfirmed ? styles.statusConfirmed : styles.statusPending}`}>
          <span className={styles.statusIcon}>{isConfirmed ? "✅" : "⚠️"}</span>
          <div>
            <p className={styles.statusMain}>
              {isConfirmed ? "確定済み" : "未確定"}
            </p>
            <p className={styles.statusSub}>
              {isConfirmed
                ? "休会・退会申請は翌々月以降が有効日となります。"
                : "休会・退会申請は翌月が有効日となります。"}
            </p>
          </div>
        </div>
      </section>

      {/* 確定フォーム */}
      {!isConfirmed && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{nextMonthLabel}を確定する</h2>
          <div className={styles.formCard}>
            <label className={styles.label} htmlFor="billing-note">
              メモ（任意）
            </label>
            <input
              id="billing-note"
              type="text"
              className={styles.input}
              placeholder="例: 5月分振替データ確定"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isPending}
            />
            <button
              className={styles.confirmBtn}
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? "処理中..." : `${nextMonthLabel}の振替データを確定する`}
            </button>
          </div>
        </section>
      )}

      {/* フィードバック */}
      {feedback && (
        <div className={`${styles.feedback} ${feedback.type === "ok" ? styles.feedbackOk : styles.feedbackError}`}>
          {feedback.message}
        </div>
      )}

      {/* 確定履歴 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>確定履歴</h2>
        {history.length === 0 ? (
          <p className={styles.empty}>確定記録がありません。</p>
        ) : (
          <div className={styles.historyList}>
            {history.map((rec) => {
              const [y, m] = rec.billing_month.split("-");
              const label = `${y}年${Number(m)}月`;
              const confirmedAt = new Date(rec.confirmed_at).toLocaleString("ja-JP", {
                timeZone: "Asia/Tokyo",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
              });
              return (
                <div key={rec.id} className={styles.historyRow}>
                  <div className={styles.historyInfo}>
                    <span className={styles.historyMonth}>{label}</span>
                    <span className={styles.historyDate}>{confirmedAt} 確定</span>
                    {rec.note && <span className={styles.historyNote}>{rec.note}</span>}
                  </div>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(rec.id, label)}
                    disabled={isPending}
                  >
                    取消
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

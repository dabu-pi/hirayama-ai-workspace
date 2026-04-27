"use client";

import { useState, useTransition } from "react";

import {
  deleteConsultationRequest,
  updateConsultationRequest
} from "@/app/admin/gym-requests/actions";
import {
  REQUEST_TYPE_LABELS,
  STATUS_LABELS,
  type GymConsultationRequest,
  type RequestStatus
} from "@/lib/gym/consultation-types";

import styles from "./GymRequestsScreen.module.css";

type EditState = {
  status: RequestStatus;
  adminNote: string;
};

type GymRequestsScreenProps = {
  requests: GymConsultationRequest[];
};

export function GymRequestsScreen({ requests: initial }: GymRequestsScreenProps) {
  const [items, setItems] = useState<GymConsultationRequest[]>(initial);
  const [editing, setEditing] = useState<Record<string, EditState>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function getEditState(item: GymConsultationRequest): EditState {
    return editing[item.id] ?? { status: item.status, adminNote: item.admin_note };
  }

  function setEditField<K extends keyof EditState>(id: string, key: K, value: EditState[K]) {
    setEditing((prev) => ({
      ...prev,
      [id]: { ...getEditState({ id } as GymConsultationRequest), ...prev[id], [key]: value }
    }));
  }

  function handleSave(item: GymConsultationRequest) {
    const state = getEditState(item);
    setErrorMsg(null);
    startTransition(async () => {
      const result = await updateConsultationRequest(item.id, state.status, state.adminNote);
      if (!result.ok) {
        setErrorMsg(result.error ?? "更新に失敗しました。");
        return;
      }
      setItems((prev) =>
        prev.map((r) =>
          r.id === item.id
            ? { ...r, status: state.status, admin_note: state.adminNote }
            : r
        )
      );
    });
  }

  function handleDelete(item: GymConsultationRequest) {
    if (!window.confirm(`「${item.requester_name}」の申込を削除しますか？`)) return;
    setErrorMsg(null);
    startTransition(async () => {
      const result = await deleteConsultationRequest(item.id);
      if (!result.ok) {
        setErrorMsg(result.error ?? "削除に失敗しました。");
        return;
      }
      setItems((prev) => prev.filter((r) => r.id !== item.id));
    });
  }

  const STATUS_OPTIONS: RequestStatus[] = ["new", "contacted", "closed"];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>相談申込管理</h1>
        <span className={styles.adminBadge}>Admin</span>
      </header>

      <nav className={styles.adminNav}>
        <a className={styles.navLink} href="/admin">← 管理トップ</a>
        <span className={styles.navSep}>|</span>
        <a className={styles.navLink} href="/admin/members">会員管理</a>
        <span className={styles.navSep}>|</span>
        <a className={styles.navLink} href="/admin/gym-announcements">お知らせ管理</a>
        <span className={styles.navSep}>|</span>
        <a className={styles.navLink} href="/admin/gym-sponsors">スポンサー管理</a>
      </nav>

      {errorMsg && <p className={styles.errorMsg}>{errorMsg}</p>}

      <section className={styles.listSection}>
        <h2 className={styles.listTitle}>申込一覧（{items.length}件）</h2>
        {items.length === 0 ? (
          <p className={styles.empty}>相談・申込はまだありません。</p>
        ) : (
          <div className={styles.list}>
            {items.map((item) => {
              const state = getEditState(item);
              const isDirty =
                state.status !== item.status || state.adminNote !== item.admin_note;
              return (
                <div className={`${styles.card} ${styles[`status_${item.status}`]}`} key={item.id}>
                  {/* Header row */}
                  <div className={styles.cardMeta}>
                    <span className={`${styles.statusBadge} ${styles[`badge_${item.status}`]}`}>
                      {STATUS_LABELS[item.status]}
                    </span>
                    <span className={styles.requestType}>
                      {REQUEST_TYPE_LABELS[item.request_type]}
                    </span>
                    <span className={styles.date}>
                      {item.created_at.slice(0, 10)}
                    </span>
                  </div>

                  {/* Requester info */}
                  <p className={styles.requesterName}>{item.requester_name}</p>
                  {item.contact && (
                    <p className={styles.contact}>{item.contact}</p>
                  )}
                  {item.preferred_date && (
                    <p className={styles.preferredDate}>
                      希望日時: {item.preferred_date}
                    </p>
                  )}
                  {item.message && (
                    <p className={styles.message}>{item.message}</p>
                  )}

                  {/* Admin controls */}
                  <div className={styles.adminControls}>
                    <div className={styles.controlRow}>
                      <label className={styles.controlLabel}>ステータス</label>
                      <select
                        className={styles.statusSelect}
                        value={state.status}
                        onChange={(e) =>
                          setEditField(item.id, "status", e.target.value as RequestStatus)
                        }
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.controlRow}>
                      <label className={styles.controlLabel}>メモ</label>
                      <textarea
                        className={styles.noteInput}
                        placeholder="管理者メモ（非公開）"
                        rows={2}
                        value={state.adminNote}
                        onChange={(e) =>
                          setEditField(item.id, "adminNote", e.target.value)
                        }
                      />
                    </div>

                    <div className={styles.cardActions}>
                      <button
                        className={styles.btnSave}
                        disabled={isPending || !isDirty}
                        type="button"
                        onClick={() => handleSave(item)}
                      >
                        {isPending ? "保存中…" : "保存"}
                      </button>
                      <button
                        className={styles.btnDelete}
                        disabled={isPending}
                        type="button"
                        onClick={() => handleDelete(item)}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

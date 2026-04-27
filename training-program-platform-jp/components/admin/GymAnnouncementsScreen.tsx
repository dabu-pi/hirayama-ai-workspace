"use client";

import { useState, useTransition } from "react";

import {
  createAnnouncement,
  deleteAnnouncement,
  updateAnnouncement
} from "@/app/admin/gym-announcements/actions";
import type { GymAnnouncement } from "@/lib/gym/announcements";

import styles from "./GymAnnouncementsScreen.module.css";

type FormState = {
  title: string;
  body: string;
  is_published: boolean;
  display_order: number;
};

const EMPTY_FORM: FormState = {
  title: "",
  body: "",
  is_published: false,
  display_order: 0
};

type GymAnnouncementsScreenProps = {
  announcements: GymAnnouncement[];
};

export function GymAnnouncementsScreen({ announcements: initial }: GymAnnouncementsScreenProps) {
  const [items, setItems] = useState<GymAnnouncement[]>(initial);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startEdit(item: GymAnnouncement) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      body: item.body,
      is_published: item.is_published,
      display_order: item.display_order
    });
    setErrorMsg(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrorMsg(null);
  }

  function handleSave() {
    if (!form.title.trim()) {
      setErrorMsg("タイトルは必須です。");
      return;
    }
    setErrorMsg(null);

    startTransition(async () => {
      if (editingId) {
        const result = await updateAnnouncement(editingId, form);
        if (!result.ok) {
          setErrorMsg(result.error ?? "更新に失敗しました。");
          return;
        }
        setItems((prev) =>
          prev.map((a) =>
            a.id === editingId
              ? {
                  ...a,
                  title: form.title.trim(),
                  body: form.body.trim(),
                  is_published: form.is_published,
                  display_order: form.display_order
                }
              : a
          )
        );
      } else {
        const result = await createAnnouncement(form);
        if (!result.ok) {
          setErrorMsg(result.error ?? "作成に失敗しました。");
          return;
        }
        // Reload-free refresh: optimistic add without actual id/timestamps;
        // the user can reload to get the real row.
        setItems((prev) => [
          {
            id: `temp-${Date.now()}`,
            title: form.title.trim(),
            body: form.body.trim(),
            is_published: form.is_published,
            display_order: form.display_order,
            published_at: form.is_published ? new Date().toISOString() : null,
            created_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          ...prev
        ]);
      }
      cancelEdit();
    });
  }

  function handleDelete(id: string, title: string) {
    if (!window.confirm(`「${title}」を削除しますか？`)) return;

    startTransition(async () => {
      const result = await deleteAnnouncement(id);
      if (!result.ok) {
        setErrorMsg(result.error ?? "削除に失敗しました。");
        return;
      }
      setItems((prev) => prev.filter((a) => a.id !== id));
    });
  }

  const isCreating = editingId === null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>お知らせ管理</h1>
        <span className={styles.adminBadge}>Admin</span>
      </header>

      <nav className={styles.adminNav}>
        <a className={styles.navLink} href="/admin/members">← 会員管理</a>
      </nav>

      {/* Form: create or edit */}
      <section className={styles.formSection}>
        <h2 className={styles.formTitle}>
          {isCreating ? "新規作成" : "編集中"}
        </h2>

        {errorMsg && <p className={styles.errorMsg}>{errorMsg}</p>}

        <div className={styles.formRow}>
          <label className={styles.label} htmlFor="ann-title">タイトル</label>
          <input
            className={styles.input}
            id="ann-title"
            maxLength={200}
            placeholder="お知らせタイトル"
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>

        <div className={styles.formRow}>
          <label className={styles.label} htmlFor="ann-body">本文</label>
          <textarea
            className={styles.textarea}
            id="ann-body"
            placeholder="お知らせ本文"
            rows={4}
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          />
        </div>

        <div className={styles.formRow}>
          <label className={styles.label} htmlFor="ann-order">表示順（小さいほど上）</label>
          <input
            className={styles.inputSmall}
            id="ann-order"
            min={0}
            type="number"
            value={form.display_order}
            onChange={(e) =>
              setForm((f) => ({ ...f, display_order: parseInt(e.target.value, 10) || 0 }))
            }
          />
        </div>

        <div className={styles.formRowInline}>
          <label className={styles.checkboxLabel}>
            <input
              checked={form.is_published}
              type="checkbox"
              onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))}
            />
            公開する
          </label>
        </div>

        <div className={styles.formActions}>
          <button
            className={styles.btnPrimary}
            disabled={isPending}
            type="button"
            onClick={handleSave}
          >
            {isPending ? "保存中…" : isCreating ? "作成" : "保存"}
          </button>
          {!isCreating && (
            <button
              className={styles.btnSecondary}
              disabled={isPending}
              type="button"
              onClick={cancelEdit}
            >
              キャンセル
            </button>
          )}
        </div>
      </section>

      {/* List */}
      <section className={styles.listSection}>
        <h2 className={styles.listTitle}>一覧（{items.length}件）</h2>
        {items.length === 0 ? (
          <p className={styles.empty}>お知らせはまだありません。</p>
        ) : (
          <div className={styles.list}>
            {items.map((item) => (
              <div
                className={`${styles.listItem} ${editingId === item.id ? styles.listItemEditing : ""}`}
                key={item.id}
              >
                <div className={styles.listItemMeta}>
                  <span
                    className={item.is_published ? styles.badgePublished : styles.badgeDraft}
                  >
                    {item.is_published ? "公開" : "非公開"}
                  </span>
                  <span className={styles.listItemOrder}>順: {item.display_order}</span>
                </div>
                <p className={styles.listItemTitle}>{item.title}</p>
                {item.body && (
                  <p className={styles.listItemBody}>{item.body}</p>
                )}
                {item.published_at && (
                  <p className={styles.listItemDate}>
                    公開日: {item.published_at.slice(0, 10)}
                  </p>
                )}
                <div className={styles.listItemActions}>
                  <button
                    className={styles.btnEdit}
                    disabled={isPending}
                    type="button"
                    onClick={() => startEdit(item)}
                  >
                    編集
                  </button>
                  <button
                    className={styles.btnDelete}
                    disabled={isPending}
                    type="button"
                    onClick={() => handleDelete(item.id, item.title)}
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

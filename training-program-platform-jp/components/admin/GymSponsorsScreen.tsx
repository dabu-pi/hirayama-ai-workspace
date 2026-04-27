"use client";

import { useState, useTransition } from "react";

import {
  createSponsor,
  deleteSponsor,
  updateSponsor
} from "@/app/admin/gym-sponsors/actions";
import type { GymSponsor } from "@/lib/gym/sponsors";

import styles from "./GymSponsorsScreen.module.css";

type FormState = {
  name: string;
  description: string;
  url: string;
  image_url: string;
  is_published: boolean;
  display_order: number;
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  url: "",
  image_url: "",
  is_published: true,
  display_order: 0
};

type GymSponsorsScreenProps = {
  sponsors: GymSponsor[];
};

export function GymSponsorsScreen({ sponsors: initial }: GymSponsorsScreenProps) {
  const [items, setItems] = useState<GymSponsor[]>(initial);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startEdit(item: GymSponsor) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description,
      url: item.url ?? "",
      image_url: item.image_url ?? "",
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
    if (!form.name.trim()) {
      setErrorMsg("名称は必須です。");
      return;
    }
    setErrorMsg(null);

    startTransition(async () => {
      if (editingId) {
        const result = await updateSponsor(editingId, form);
        if (!result.ok) {
          setErrorMsg(result.error ?? "更新に失敗しました。");
          return;
        }
        setItems((prev) =>
          prev.map((s) =>
            s.id === editingId
              ? {
                  ...s,
                  name: form.name.trim(),
                  description: form.description.trim(),
                  url: form.url.trim() || null,
                  image_url: form.image_url.trim() || null,
                  is_published: form.is_published,
                  display_order: form.display_order
                }
              : s
          )
        );
      } else {
        const result = await createSponsor(form);
        if (!result.ok) {
          setErrorMsg(result.error ?? "作成に失敗しました。");
          return;
        }
        setItems((prev) => [
          {
            id: `temp-${Date.now()}`,
            name: form.name.trim(),
            description: form.description.trim(),
            url: form.url.trim() || null,
            image_url: form.image_url.trim() || null,
            is_published: form.is_published,
            display_order: form.display_order,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          ...prev
        ]);
      }
      cancelEdit();
    });
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`「${name}」を削除しますか？`)) return;

    startTransition(async () => {
      const result = await deleteSponsor(id);
      if (!result.ok) {
        setErrorMsg(result.error ?? "削除に失敗しました。");
        return;
      }
      setItems((prev) => prev.filter((s) => s.id !== id));
    });
  }

  const isCreating = editingId === null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>スポンサー管理</h1>
        <span className={styles.adminBadge}>Admin</span>
      </header>

      <nav className={styles.adminNav}>
        <a className={styles.navLink} href="/admin/members">← 会員管理</a>
        <span className={styles.navSep}>|</span>
        <a className={styles.navLink} href="/admin/gym-announcements">お知らせ管理</a>
      </nav>

      {/* Form: create or edit */}
      <section className={styles.formSection}>
        <h2 className={styles.formTitle}>
          {isCreating ? "新規作成" : "編集中"}
        </h2>

        {errorMsg && <p className={styles.errorMsg}>{errorMsg}</p>}

        <div className={styles.formRow}>
          <label className={styles.label} htmlFor="sp-name">名称</label>
          <input
            className={styles.input}
            id="sp-name"
            maxLength={200}
            placeholder="スポンサー名・協力店名"
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>

        <div className={styles.formRow}>
          <label className={styles.label} htmlFor="sp-description">説明</label>
          <input
            className={styles.input}
            id="sp-description"
            maxLength={300}
            placeholder="業種・サービス内容など"
            type="text"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>

        <div className={styles.formRow}>
          <label className={styles.label} htmlFor="sp-url">URL（任意）</label>
          <input
            className={styles.input}
            id="sp-url"
            maxLength={500}
            placeholder="https://example.com"
            type="url"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          />
        </div>

        <div className={styles.formRow}>
          <label className={styles.label} htmlFor="sp-order">表示順（小さいほど上）</label>
          <input
            className={styles.inputSmall}
            id="sp-order"
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
          <p className={styles.empty}>スポンサー・協力店はまだありません。</p>
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
                <p className={styles.listItemTitle}>{item.name}</p>
                {item.description && (
                  <p className={styles.listItemBody}>{item.description}</p>
                )}
                {item.url && (
                  <p className={styles.listItemUrl}>
                    <a
                      href={item.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {item.url}
                    </a>
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
                    onClick={() => handleDelete(item.id, item.name)}
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

"use client";

import { useState, useTransition } from "react";

import styles from "./MyExercisesScreen.module.css";

export type UserExercise = {
  id: string;
  name: string;
  category: string | null;
  defaultUnit: string;
  memo: string;
  isArchived: boolean;
  createdAt: string;
};

type MyExercisesScreenProps = {
  exercises: UserExercise[];
};

type EditState = {
  name: string;
  category: string;
};

async function patchExercise(
  id: string,
  body: Record<string, unknown>
): Promise<{ exercise: { id: string; name: string; category: string | null; isArchived: boolean } }> {
  const res = await fetch(`/api/user-exercises/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(json.error?.message ?? "エラーが発生しました。");
  }
  return res.json() as Promise<{
    exercise: { id: string; name: string; category: string | null; isArchived: boolean };
  }>;
}

export function MyExercisesScreen({ exercises: initial }: MyExercisesScreenProps) {
  const [items, setItems] = useState<UserExercise[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ name: "", category: "" });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [isPending, startTransition] = useTransition();

  const active = items.filter((e) => !e.isArchived);
  const archived = items.filter((e) => e.isArchived);

  function startEdit(item: UserExercise) {
    setEditingId(item.id);
    setEditState({ name: item.name, category: item.category ?? "" });
    setErrorMsg(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState({ name: "", category: "" });
    setErrorMsg(null);
  }

  function handleSaveEdit() {
    const name = editState.name.trim();
    if (!name) {
      setErrorMsg("種目名は必須です。");
      return;
    }
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const result = await patchExercise(editingId!, {
          name,
          category: editState.category.trim() || null
        });
        setItems((prev) =>
          prev.map((e) =>
            e.id === editingId
              ? { ...e, name: result.exercise.name, category: result.exercise.category }
              : e
          )
        );
        cancelEdit();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "更新に失敗しました。");
      }
    });
  }

  function handleToggleArchive(item: UserExercise) {
    const msg = item.isArchived
      ? `「${item.name}」を復元しますか？`
      : `「${item.name}」をアーカイブしますか？\n過去のワークアウト記録は保持されます。`;
    if (!window.confirm(msg)) return;

    startTransition(async () => {
      try {
        await patchExercise(item.id, { is_archived: !item.isArchived });
        setItems((prev) =>
          prev.map((e) => (e.id === item.id ? { ...e, isArchived: !e.isArchived } : e))
        );
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "更新に失敗しました。");
      }
    });
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.backLink} href="/profile">
          ← プロフィール
        </a>
        <h1 className={styles.title}>マイ種目</h1>
        <p className={styles.description}>
          自分で作成したカスタム種目を管理します。アーカイブしても過去の記録は保持されます。
        </p>
      </header>

      {errorMsg && <p className={styles.errorMsg}>{errorMsg}</p>}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>使用中（{active.length}件）</h2>
        {active.length === 0 ? (
          <p className={styles.empty}>
            カスタム種目がまだありません。
            <br />
            自由トレーニング中に「＋ 新しい種目を作成」から追加できます。
          </p>
        ) : (
          <div className={styles.list}>
            {active.map((item) => (
              <div
                className={`${styles.card} ${editingId === item.id ? styles.cardEditing : ""}`}
                key={item.id}
              >
                {editingId === item.id ? (
                  <div className={styles.editForm}>
                    <div className={styles.formRow}>
                      <label className={styles.label} htmlFor={`name-${item.id}`}>
                        種目名
                      </label>
                      <input
                        className={styles.input}
                        id={`name-${item.id}`}
                        maxLength={100}
                        type="text"
                        value={editState.name}
                        onChange={(e) => setEditState((s) => ({ ...s, name: e.target.value }))}
                      />
                    </div>
                    <div className={styles.formRow}>
                      <label className={styles.label} htmlFor={`cat-${item.id}`}>
                        カテゴリ（任意）
                      </label>
                      <input
                        className={styles.input}
                        id={`cat-${item.id}`}
                        maxLength={50}
                        placeholder="例: 胸, 背中, 脚..."
                        type="text"
                        value={editState.category}
                        onChange={(e) =>
                          setEditState((s) => ({ ...s, category: e.target.value }))
                        }
                      />
                    </div>
                    <div className={styles.actions}>
                      <button
                        className={styles.btnPrimary}
                        disabled={isPending}
                        type="button"
                        onClick={handleSaveEdit}
                      >
                        {isPending ? "保存中…" : "保存"}
                      </button>
                      <button
                        className={styles.btnSecondary}
                        disabled={isPending}
                        type="button"
                        onClick={cancelEdit}
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={styles.cardInfo}>
                      <p className={styles.cardName}>{item.name}</p>
                      {item.category && (
                        <span className={styles.cardCategory}>{item.category}</span>
                      )}
                    </div>
                    <div className={styles.actions}>
                      <button
                        className={styles.btnEdit}
                        disabled={isPending}
                        type="button"
                        onClick={() => startEdit(item)}
                      >
                        編集
                      </button>
                      <button
                        className={styles.btnArchive}
                        disabled={isPending}
                        type="button"
                        onClick={() => handleToggleArchive(item)}
                      >
                        アーカイブ
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {archived.length > 0 && (
        <section className={styles.section}>
          <button
            className={styles.toggleArchived}
            type="button"
            onClick={() => setShowArchived((s) => !s)}
          >
            アーカイブ済み（{archived.length}件）{showArchived ? " ▲" : " ▼"}
          </button>
          {showArchived && (
            <div className={styles.list}>
              {archived.map((item) => (
                <div className={`${styles.card} ${styles.cardArchived}`} key={item.id}>
                  <div className={styles.cardInfo}>
                    <p className={styles.cardName}>{item.name}</p>
                    {item.category && (
                      <span className={styles.cardCategory}>{item.category}</span>
                    )}
                  </div>
                  <div className={styles.actions}>
                    <button
                      className={styles.btnSecondary}
                      disabled={isPending}
                      type="button"
                      onClick={() => handleToggleArchive(item)}
                    >
                      復元
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  createSupabaseBrowserClient,
  hasSupabaseBrowserEnv
} from "@/lib/supabase/client";

import styles from "./page.module.css";

type AuthMode = "sign_in" | "sign_up";

export default function LoginPage() {
  const router = useRouter();
  const [supabase] = useState(() =>
    hasSupabaseBrowserEnv() ? createSupabaseBrowserClient() : null
  );
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isActive = true;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!isActive || error || !data.user) return;

        // Before auto-redirecting, check whether this user has soft-deleted
        // their app account. If so, sign them out and stay on the login page.
        const { data: userRow } = await supabase
          .from("users")
          .select("app_deleted_at")
          .eq("id", data.user.id)
          .maybeSingle<{ app_deleted_at: string | null }>();

        if (!isActive) return;

        if (userRow?.app_deleted_at) {
          await supabase.auth.signOut();
          return; // Stay on login page — do not auto-redirect
        }

        router.replace("/");
        router.refresh();
      } catch {
        // Ignore auth lookup failure and let the user continue manually.
      }
    })();

    return () => {
      isActive = false;
    };
  }, [router, supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setNoticeMessage(null);

    if (!supabase) {
      setErrorMessage("認証環境が設定されていません。管理者にお問い合わせください。");
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "sign_in") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        router.push("/");
        router.refresh();
        return;
      }

      const trimmedName = displayName.trim();
      if (!trimmedName) {
        setErrorMessage("お名前を入力してください");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: trimmedName } }
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data.session) {
        router.push("/");
        router.refresh();
        return;
      }

      setNoticeMessage(
        "アカウントを作成しました。メール確認が有効な環境では、確認後にログインしてください。"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const submitLabel =
    mode === "sign_in"
      ? isSubmitting
        ? "ログイン中..."
        : "ログイン"
      : isSubmitting
        ? "登録中..."
        : "新規登録";

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <h1 className={styles.title}>ログインしてトレーニングを続けましょう</h1>
          <p className={styles.description}>
            プログラム一覧はログインなしで見られます。ワークアウトの記録・進捗管理にはログインが必要です。
          </p>
        </header>

        <div className={styles.toggleRow} aria-label="Authentication mode">
          <button
            className={`${styles.toggleButton} ${
              mode === "sign_in" ? styles.toggleButtonActive : ""
            }`}
            onClick={() => { setMode("sign_in"); setDisplayName(""); setErrorMessage(null); }}
            type="button"
          >
            ログイン
          </button>
          <button
            className={`${styles.toggleButton} ${
              mode === "sign_up" ? styles.toggleButtonActive : ""
            }`}
            onClick={() => { setMode("sign_up"); setErrorMessage(null); }}
            type="button"
          >
            新規登録
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {mode === "sign_up" && (
            <label className={styles.field}>
              <span className={styles.label}>お名前</span>
              <input
                autoComplete="name"
                className={styles.input}
                maxLength={50}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="山田 太郎"
                required
                type="text"
                value={displayName}
              />
            </label>
          )}

          <label className={styles.field}>
            <span className={styles.label}>メールアドレス</span>
            <input
              autoComplete="email"
              className={styles.input}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>パスワード</span>
            <input
              autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
              className={styles.input}
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="6文字以上"
              required
              type="password"
              value={password}
            />
          </label>

          {errorMessage && (
            <p className={`${styles.message} ${styles.error}`}>{errorMessage}</p>
          )}

          {noticeMessage && (
            <p className={`${styles.message} ${styles.notice}`}>{noticeMessage}</p>
          )}

          {!supabase && (
            <p className={`${styles.message} ${styles.error}`}>
              認証環境が設定されていません。管理者にお問い合わせください。
            </p>
          )}

          <button
            className={styles.submitButton}
            disabled={isSubmitting || !supabase}
            type="submit"
          >
            {submitLabel}
          </button>
        </form>

        <footer className={styles.footer}>
          <span>プログラム一覧へ戻る:</span>
          <Link className={styles.footerLink} href="/programs">
            プログラム一覧を見る
          </Link>
        </footer>
      </section>
    </main>
  );
}

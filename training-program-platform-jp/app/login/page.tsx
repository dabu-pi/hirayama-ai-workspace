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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isActive = true;

    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!isActive || error) return;
        if (data.user) {
          router.replace("/");
          router.refresh();
        }
      })
      .catch(() => {
        // Ignore initial auth lookup failure and let the user continue manually.
      });

    return () => {
      isActive = false;
    };
  }, [router, supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setNoticeMessage(null);

    if (!supabase) {
      setErrorMessage("Supabase environment is not configured for browser auth.");
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

      const { data, error } = await supabase.auth.signUp({
        email,
        password
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
        ? "Signing in..."
        : "Sign In"
      : isSubmitting
        ? "Creating account..."
        : "Create Account";

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Phase B</span>
          <h1 className={styles.title}>Sign in to continue your training</h1>
          <p className={styles.description}>
            Programs は引き続き public ですが、ワークアウト開始や今後の個人データ保護にはログインを使います。
          </p>
        </header>

        <div className={styles.toggleRow} aria-label="Authentication mode">
          <button
            className={`${styles.toggleButton} ${
              mode === "sign_in" ? styles.toggleButtonActive : ""
            }`}
            onClick={() => setMode("sign_in")}
            type="button"
          >
            Sign In
          </button>
          <button
            className={`${styles.toggleButton} ${
              mode === "sign_up" ? styles.toggleButtonActive : ""
            }`}
            onClick={() => setMode("sign_up")}
            type="button"
          >
            Sign Up
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>Email</span>
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
            <span className={styles.label}>Password</span>
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
              Supabase environment is not configured for browser auth.
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
          <span>公開中の Programs 一覧へ戻る:</span>
          <Link className={styles.footerLink} href="/programs">
            Browse Programs
          </Link>
        </footer>
      </section>
    </main>
  );
}

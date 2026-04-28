"use client";

import { useState, useTransition } from "react";

import { submitConsultationRequest } from "@/app/gym/actions";
import type { RequestType } from "@/lib/gym/consultation-types";

import styles from "./GymConsultationForm.module.css";

type FormState = {
  requester_name: string;
  contact: string;
  request_type: RequestType;
  preferred_date: string;
  message: string;
};

const EMPTY_FORM: FormState = {
  requester_name: "",
  contact: "",
  request_type: "trainer_consultation",
  preferred_date: "",
  message: ""
};

const REQUEST_TYPE_OPTIONS: { value: RequestType; label: string }[] = [
  { value: "trainer_consultation", label: "トレーナー相談" },
  { value: "personal_training",    label: "パーソナルトレーニング申込" },
  { value: "other",                label: "その他" }
];

export function GymConsultationForm() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!form.requester_name.trim()) {
      setErrorMsg("お名前を入力してください。");
      return;
    }
    setErrorMsg(null);

    startTransition(async () => {
      const result = await submitConsultationRequest(form);
      if (!result.ok) {
        setErrorMsg("送信に失敗しました。しばらく後にお試しください。");
        return;
      }
      setSubmitted(true);
      setForm(EMPTY_FORM);
    });
  }

  if (submitted) {
    return (
      <div className={styles.successCard}>
        <p className={styles.successIcon}>✓</p>
        <p className={styles.successTitle}>送信しました</p>
        <p className={styles.successBody}>
          スタッフより順次ご連絡いたします。しばらくお待ちください。
        </p>
        <button
          className={styles.resetBtn}
          type="button"
          onClick={() => setSubmitted(false)}
        >
          別の内容を送信する
        </button>
      </div>
    );
  }

  return (
    <div className={styles.formCard}>
      {errorMsg && <p className={styles.errorMsg}>{errorMsg}</p>}

      <div className={styles.formRow}>
        <label className={styles.label} htmlFor="cf-name">
          お名前 <span className={styles.required}>必須</span>
        </label>
        <input
          className={styles.input}
          id="cf-name"
          maxLength={100}
          placeholder="山田 太郎"
          type="text"
          value={form.requester_name}
          onChange={(e) => setForm((f) => ({ ...f, requester_name: e.target.value }))}
        />
      </div>

      <div className={styles.formRow}>
        <label className={styles.label} htmlFor="cf-contact">
          連絡先（電話・メールなど）
        </label>
        <input
          className={styles.input}
          id="cf-contact"
          maxLength={200}
          placeholder="090-xxxx-xxxx / example@email.com"
          type="text"
          value={form.contact}
          onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
        />
      </div>

      <div className={styles.formRow}>
        <label className={styles.label} htmlFor="cf-type">
          相談・申込の種別
        </label>
        <select
          className={styles.select}
          id="cf-type"
          value={form.request_type}
          onChange={(e) =>
            setForm((f) => ({ ...f, request_type: e.target.value as RequestType }))
          }
        >
          {REQUEST_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formRow}>
        <label className={styles.label} htmlFor="cf-date">
          ご希望日時・日程（任意）
        </label>
        <input
          className={styles.input}
          id="cf-date"
          maxLength={100}
          placeholder="例: 平日午前、土曜 10時ごろ"
          type="text"
          value={form.preferred_date}
          onChange={(e) => setForm((f) => ({ ...f, preferred_date: e.target.value }))}
        />
      </div>

      <div className={styles.formRow}>
        <label className={styles.label} htmlFor="cf-message">
          内容・ご要望（任意）
        </label>
        <textarea
          className={styles.textarea}
          id="cf-message"
          maxLength={1000}
          placeholder="ご相談内容、目標、現在の状況など自由にご記入ください。"
          rows={4}
          value={form.message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
        />
      </div>

      <button
        className={styles.submitBtn}
        disabled={isPending}
        type="button"
        onClick={handleSubmit}
      >
        {isPending ? "送信中…" : "送信する"}
      </button>
    </div>
  );
}

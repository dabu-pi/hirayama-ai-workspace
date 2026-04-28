import Link from "next/link";

import type { MembershipStatus } from "@/lib/workout/membership";

import styles from "./TrainAuthRequired.module.css";

type Copy = { eyebrow: string; title: string; body: string };

function getCopy(status: MembershipStatus | null | undefined): Copy {
  switch (status) {
    case "paused":
      return {
        eyebrow: "休会中",
        title: "現在、休会中です",
        body: "現在、休会中のためトレーニング機能はご利用いただけません。再開をご希望の場合は、スタッフまでご連絡ください。",
      };
    case "cancelled":
      return {
        eyebrow: "退会済み",
        title: "ご利用状況をご確認ください",
        body: "現在、このアカウントではトレーニング機能をご利用いただけません。再度利用をご希望の場合は、スタッフまでお問い合わせください。",
      };
    default:
      return {
        eyebrow: "ご利用停止中",
        title: "現在ご利用を一時停止しています",
        body: "現在、アカウントのご利用を一時停止しています。詳細はスタッフまでお問い合わせください。",
      };
  }
}

type Props = {
  status?: MembershipStatus | null;
};

export function MembershipRequiredScreen({ status }: Props) {
  const copy = getCopy(status);
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>{copy.eyebrow}</span>
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.body}>
          {copy.body}
          <br />
          ご不明な点があれば、スタッフまでお気軽にお問い合わせください。
        </p>
      </section>

      <div className={styles.actions}>
        <Link className={styles.programsLink} href="/gym">
          ジムページへ
        </Link>
      </div>
    </main>
  );
}

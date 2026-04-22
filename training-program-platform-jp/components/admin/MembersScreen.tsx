"use client";

import { useState, useTransition } from "react";

import { updateMembershipStatus } from "@/app/admin/members/actions";
import type { MemberRow, MembershipStatus } from "@/lib/admin/members";

import styles from "./MembersScreen.module.css";

type MembersScreenProps = {
  members: MemberRow[];
  currentUserId: string;
};

export function MembersScreen({ members, currentUserId }: MembersScreenProps) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>会員管理</h1>
        <span className={styles.adminBadge}>Admin</span>
      </header>

      <div className={styles.card}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <th>表示名</th>
              <th>ロール</th>
              <th>ステータス変更</th>
              <th>登録日</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <MemberRowItem
                key={member.id}
                isSelf={member.id === currentUserId}
                member={member}
              />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

type MemberRowItemProps = {
  member: MemberRow;
  isSelf: boolean;
};

function MemberRowItem({ member, isSelf }: MemberRowItemProps) {
  const [selected, setSelected] = useState<MembershipStatus>(
    member.membership_status
  );
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDirty = selected !== member.membership_status;

  function handleSave() {
    setFeedback(null);
    startTransition(async () => {
      const result = await updateMembershipStatus(member.id, selected);
      if (result.ok) {
        setFeedback({ ok: true, message: "保存済み" });
        // Clear feedback after 2 s
        setTimeout(() => setFeedback(null), 2000);
      } else {
        setFeedback({ ok: false, message: result.error ?? "エラー" });
      }
    });
  }

  const createdDate = new Date(member.created_at).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo"
  });

  return (
    <tr className={styles.tr}>
      <td className={styles.td}>
        {member.display_name ? (
          <span className={styles.displayName}>{member.display_name}</span>
        ) : (
          <span className={styles.noName}>（未設定）</span>
        )}
      </td>
      <td className={styles.td}>
        <span
          className={`${styles.roleBadge} ${
            member.role === "admin" ? styles.roleAdmin : styles.roleUser
          }`}
        >
          {member.role}
        </span>
      </td>
      <td className={styles.td}>
        {isSelf ? (
          <span className={styles.selfNote}>自分自身は変更できません</span>
        ) : (
          <div className={styles.statusCell}>
            <select
              className={styles.statusSelect}
              disabled={isPending}
              value={selected}
              onChange={(e) =>
                setSelected(e.target.value as MembershipStatus)
              }
            >
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="cancelled">cancelled</option>
            </select>
            <button
              className={styles.saveButton}
              disabled={!isDirty || isPending}
              type="button"
              onClick={handleSave}
            >
              {isPending ? "保存中…" : "保存"}
            </button>
            {feedback && (
              <span
                className={`${styles.feedback} ${
                  feedback.ok ? styles.feedbackOk : styles.feedbackError
                }`}
              >
                {feedback.ok ? "✓ " : "✗ "}
                {feedback.message}
              </span>
            )}
          </div>
        )}
      </td>
      <td className={styles.td}>{createdDate}</td>
    </tr>
  );
}

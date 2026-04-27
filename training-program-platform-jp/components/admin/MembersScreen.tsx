"use client";

import { useState, useTransition } from "react";

import { updateDisplayName, updateMemberName, updateMembershipStatus } from "@/app/admin/members/actions";
import type { AdminGlobalStats, MemberRow, MembershipStatus } from "@/lib/admin/members";
import { formatJstDate, formatJstDateTime } from "@/lib/utils/date-jst";

import styles from "./MembersScreen.module.css";

type StatusFilter = "all" | MembershipStatus;

type MembersScreenProps = {
  members: MemberRow[];
  currentUserId: string;
  globalStats: AdminGlobalStats;
};

export function MembersScreen({
  members,
  currentUserId,
  globalStats
}: MembersScreenProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      q === "" ||
      (m.member_name ?? "").toLowerCase().includes(q) ||
      (m.display_name ?? "").toLowerCase().includes(q) ||
      (m.email ?? "").toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "all" || m.membership_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>会員管理</h1>
        <span className={styles.adminBadge}>Admin</span>
      </header>

      <nav className={styles.adminNav}>
        <a className={styles.navLink} href="/admin">← 管理トップ</a>
        <span className={styles.navSep}>|</span>
        <a className={styles.navLink} href="/admin/gym-announcements">お知らせ管理 →</a>
        <span className={styles.navSep}>|</span>
        <a className={styles.navLink} href="/admin/gym-sponsors">スポンサー管理 →</a>
        <span className={styles.navSep}>|</span>
        <a className={styles.navLink} href="/admin/gym-requests">相談申込管理 →</a>
      </nav>

      {/* Summary cards */}
      <div className={styles.statsGrid}>
        <StatCard label="登録会員" value={globalStats.total_members} />
        <StatCard color="green" label="Active" value={globalStats.active_count} />
        <StatCard color="yellow" label="Paused" value={globalStats.paused_count} />
        <StatCard color="red" label="Cancelled" value={globalStats.cancelled_count} />
        <StatCard label="直近30日 完了" value={globalStats.completed_sessions_last30d} />
        <StatCard
          color={globalStats.inactive_active_members_last30d > 0 ? "yellow" : undefined}
          label="30日未利用(active)"
          value={globalStats.inactive_active_members_last30d}
        />
      </div>

      <div className={styles.filterBar}>
        <input
          className={styles.searchInput}
          placeholder="氏名・表示名・メールで検索"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">すべて</option>
          <option value="active">active</option>
          <option value="paused">paused</option>
          <option value="cancelled">cancelled</option>
        </select>
      </div>

      <div className={styles.card}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <th>会員氏名</th>
              <th>表示名</th>
              <th>ロール</th>
              <th>ステータス変更</th>
              <th>最終ログイン</th>
              <th>開始/完了</th>
              <th>最終T</th>
              <th>登録日</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member) => (
                <MemberRowItem
                  key={member.id}
                  isSelf={member.id === currentUserId}
                  member={member}
                />
              ))
            ) : (
              <tr>
                <td className={styles.emptyNote} colSpan={8}>
                  該当する会員が見つかりません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  color
}: {
  label: string;
  value: number;
  color?: "green" | "yellow" | "red";
}) {
  const colorClass =
    color === "green"
      ? styles.statGreen
      : color === "yellow"
        ? styles.statYellow
        : color === "red"
          ? styles.statRed
          : "";
  return (
    <div className={`${styles.statCard} ${colorClass}`}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

type MemberRowItemProps = {
  member: MemberRow;
  isSelf: boolean;
};

function MemberRowItem({ member, isSelf }: MemberRowItemProps) {
  // Status state
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
        setTimeout(() => setFeedback(null), 2000);
      } else {
        setFeedback({ ok: false, message: result.error ?? "エラー" });
      }
    });
  }

  // Member name (admin-managed) edit state
  const [currentMemberName, setCurrentMemberName] = useState<string | null>(
    member.member_name
  );
  const [isMemberEditing, setIsMemberEditing] = useState(false);
  const [memberEditValue, setMemberEditValue] = useState("");
  const [memberFeedback, setMemberFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [isMemberPending, startMemberTransition] = useTransition();

  // Display name edit state
  const [currentDisplayName, setCurrentDisplayName] = useState<string | null>(
    member.display_name
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [nameFeedback, setNameFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [isNamePending, startNameTransition] = useTransition();

  function handleMemberEditOpen() {
    setMemberEditValue(currentMemberName ?? "");
    setMemberFeedback(null);
    setIsMemberEditing(true);
  }

  function handleMemberEditCancel() {
    setIsMemberEditing(false);
    setMemberFeedback(null);
  }

  function handleMemberNameSave() {
    setMemberFeedback(null);
    startMemberTransition(async () => {
      const result = await updateMemberName(member.id, memberEditValue);
      if (result.ok) {
        setCurrentMemberName(memberEditValue.trim() || null);
        setIsMemberEditing(false);
        setMemberFeedback({ ok: true, message: "保存済み" });
        setTimeout(() => setMemberFeedback(null), 2000);
      } else {
        setMemberFeedback({ ok: false, message: result.error ?? "エラー" });
      }
    });
  }

  function handleEditOpen() {
    setEditValue(currentDisplayName ?? "");
    setNameFeedback(null);
    setIsEditing(true);
  }

  function handleEditCancel() {
    setIsEditing(false);
    setNameFeedback(null);
  }

  function handleNameSave() {
    setNameFeedback(null);
    startNameTransition(async () => {
      const result = await updateDisplayName(member.id, editValue);
      if (result.ok) {
        setCurrentDisplayName(editValue.trim() || null);
        setIsEditing(false);
        setNameFeedback({ ok: true, message: "保存済み" });
        setTimeout(() => setNameFeedback(null), 2000);
      } else {
        setNameFeedback({ ok: false, message: result.error ?? "エラー" });
      }
    });
  }

  const createdDate = formatJstDate(member.created_at);
  const lastSignIn = member.last_sign_in_at
    ? formatJstDateTime(member.last_sign_in_at)
    : "—";
  const lastTraining = member.last_training_at
    ? formatJstDate(member.last_training_at)
    : "—";

  return (
    <tr className={styles.tr}>
      {/* 会員氏名 */}
      <td className={styles.td}>
        {isMemberEditing ? (
          <div className={styles.editRow}>
            <input
              autoFocus
              className={styles.editInput}
              disabled={isMemberPending}
              type="text"
              value={memberEditValue}
              onChange={(e) => setMemberEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleMemberNameSave();
                if (e.key === "Escape") handleMemberEditCancel();
              }}
            />
            <div className={styles.editActions}>
              <button
                className={styles.editSaveButton}
                disabled={isMemberPending}
                type="button"
                onClick={handleMemberNameSave}
              >
                {isMemberPending ? "保存中…" : "保存"}
              </button>
              <button
                className={styles.editCancelButton}
                disabled={isMemberPending}
                type="button"
                onClick={handleMemberEditCancel}
              >
                キャンセル
              </button>
              {memberFeedback && (
                <span
                  className={`${styles.nameFeedback} ${
                    memberFeedback.ok ? styles.feedbackOk : styles.feedbackError
                  }`}
                >
                  {memberFeedback.ok ? "✓ " : "✗ "}
                  {memberFeedback.message}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.nameBlock}>
            {currentMemberName ? (
              <span className={styles.displayName}>{currentMemberName}</span>
            ) : (
              <span className={styles.noName}>（未設定）</span>
            )}
            {memberFeedback && (
              <span
                className={`${styles.nameFeedback} ${
                  memberFeedback.ok ? styles.feedbackOk : styles.feedbackError
                }`}
              >
                {memberFeedback.ok ? "✓ " : "✗ "}
                {memberFeedback.message}
              </span>
            )}
            <button
              className={styles.editButton}
              type="button"
              onClick={handleMemberEditOpen}
            >
              編集
            </button>
          </div>
        )}
      </td>

      {/* 表示名 */}
      <td className={styles.td}>
        {isEditing ? (
          <div className={styles.editRow}>
            <input
              autoFocus
              className={styles.editInput}
              disabled={isNamePending}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameSave();
                if (e.key === "Escape") handleEditCancel();
              }}
            />
            <div className={styles.editActions}>
              <button
                className={styles.editSaveButton}
                disabled={isNamePending}
                type="button"
                onClick={handleNameSave}
              >
                {isNamePending ? "保存中…" : "保存"}
              </button>
              <button
                className={styles.editCancelButton}
                disabled={isNamePending}
                type="button"
                onClick={handleEditCancel}
              >
                キャンセル
              </button>
              {nameFeedback && (
                <span
                  className={`${styles.nameFeedback} ${
                    nameFeedback.ok ? styles.feedbackOk : styles.feedbackError
                  }`}
                >
                  {nameFeedback.ok ? "✓ " : "✗ "}
                  {nameFeedback.message}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.nameBlock}>
            {currentDisplayName ? (
              <span className={styles.displayName}>{currentDisplayName}</span>
            ) : (
              <span className={styles.noName}>（未設定）</span>
            )}
            {member.email && (
              <span className={styles.email}>{member.email}</span>
            )}
            {nameFeedback && (
              <span
                className={`${styles.nameFeedback} ${
                  nameFeedback.ok ? styles.feedbackOk : styles.feedbackError
                }`}
              >
                {nameFeedback.ok ? "✓ " : "✗ "}
                {nameFeedback.message}
              </span>
            )}
            <button
              className={styles.editButton}
              type="button"
              onClick={handleEditOpen}
            >
              編集
            </button>
          </div>
        )}
      </td>

      {/* ロール */}
      <td className={styles.td}>
        <span
          className={`${styles.roleBadge} ${
            member.role === "admin" ? styles.roleAdmin : styles.roleUser
          }`}
        >
          {member.role}
        </span>
      </td>

      {/* ステータス変更 */}
      <td className={styles.td}>
        {isSelf ? (
          <span className={styles.selfNote}>自分自身は変更できません</span>
        ) : (
          <div className={styles.statusCell}>
            <select
              className={styles.statusSelect}
              disabled={isPending}
              value={selected}
              onChange={(e) => setSelected(e.target.value as MembershipStatus)}
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

      {/* 最終ログイン */}
      <td className={`${styles.td} ${styles.statCell}`}>{lastSignIn}</td>

      {/* 開始/完了 */}
      <td className={`${styles.td} ${styles.statCell}`}>
        <span className={styles.sessionCount}>
          {member.training_started_count}
          <span className={styles.sessionSep}>/</span>
          {member.training_completed_count}
        </span>
        {member.has_active_enrollment && (
          <span className={styles.enrollmentDot} title="プログラム進行中" />
        )}
      </td>

      {/* 最終T */}
      <td className={`${styles.td} ${styles.statCell}`}>{lastTraining}</td>

      {/* 登録日 */}
      <td className={`${styles.td} ${styles.statCell}`}>{createdDate}</td>
    </tr>
  );
}

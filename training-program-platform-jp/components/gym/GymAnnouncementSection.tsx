"use client";

import { useEffect, useMemo, useState } from "react";

import type { GymAnnouncement } from "@/lib/gym/announcements";
import { getReadIds, markAsRead, saveUnreadCount } from "@/lib/gym/unread-store";

import styles from "./GymAnnouncementSection.module.css";

type Props = {
  announcements: GymAnnouncement[];
};

export function GymAnnouncementSection({ announcements }: Props) {
  // Snapshot of read IDs at mount time — determines which items show "未読"
  const [readSnapshot] = useState<Set<string>>(() => new Set(getReadIds()));
  // After user clicks "全て既読にする", flip this to hide all unread indicators
  const [markedAllRead, setMarkedAllRead] = useState(false);

  const unreadCount = useMemo(
    () =>
      markedAllRead ? 0 : announcements.filter((a) => !readSnapshot.has(a.id)).length,
    [announcements, readSnapshot, markedAllRead]
  );

  // Publish unread count to BottomTabBar via localStorage on mount and on change
  useEffect(() => {
    saveUnreadCount(unreadCount);
  }, [unreadCount]);

  function handleMarkAllAsRead() {
    markAsRead(announcements.map((a) => a.id));
    setMarkedAllRead(true);
  }

  const isUnread = (id: string) => !markedAllRead && !readSnapshot.has(id);

  if (announcements.length === 0) {
    return (
      <div className={styles.emptyCard}>
        <p className={styles.emptyText}>現在お知らせはありません。</p>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {unreadCount > 0 && (
        <button className={styles.markReadBtn} onClick={handleMarkAllAsRead}>
          全て既読にする
        </button>
      )}
      <div className={styles.cardList}>
        {announcements.map((item) => (
          <div
            className={`${styles.card}${isUnread(item.id) ? ` ${styles.cardUnread}` : ""}`}
            key={item.id}
          >
            <div className={styles.cardHeader}>
              <p className={styles.cardTitle}>{item.title}</p>
              {isUnread(item.id) && (
                <span className={styles.unreadBadge} aria-label="未読">
                  未読
                </span>
              )}
            </div>
            {item.published_at && (
              <p className={styles.cardDate}>{item.published_at.slice(0, 10)}</p>
            )}
            <p className={styles.cardBody}>{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { getCachedUnreadCount } from "@/lib/gym/unread-store";

export function useGymUnreadCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(getCachedUnreadCount());

    const refresh = () => setCount(getCachedUnreadCount());
    window.addEventListener("gym_unread_updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("gym_unread_updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return count;
}

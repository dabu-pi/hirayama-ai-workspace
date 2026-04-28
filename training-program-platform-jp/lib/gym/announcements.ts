import "server-only";

import { createSupabaseAdminClient, createSupabaseServerClient, hasSupabasePublicEnv } from "@/lib/supabase/server";

export type GymAnnouncement = {
  id: string;
  title: string;
  body: string;
  is_published: boolean;
  display_order: number;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Fetches published announcements for the public /gym page.
 * Uses the user-scoped server client so RLS is applied (is_published = true only).
 * Ordered by display_order ASC, then published_at DESC.
 */
export async function getPublishedAnnouncements(): Promise<GymAnnouncement[]> {
  if (!hasSupabasePublicEnv()) return [];

  try {
    const client = createSupabaseServerClient();
    const { data, error } = await client
      .from("gym_announcements")
      .select("id, title, body, is_published, display_order, published_at, created_by, created_at, updated_at")
      .eq("is_published", true)
      .order("display_order", { ascending: true })
      .order("published_at", { ascending: false });

    if (error) {
      console.error("getPublishedAnnouncements: query failed.", error.message);
      return [];
    }
    return (data ?? []) as GymAnnouncement[];
  } catch {
    return [];
  }
}

/**
 * Fetches ALL announcements (including unpublished) for the admin page.
 * Uses the admin client to bypass RLS.
 */
export async function getAllAnnouncements(): Promise<GymAnnouncement[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("gym_announcements")
    .select("id, title, body, is_published, display_order, published_at, created_by, created_at, updated_at")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAllAnnouncements: query failed.", error.message);
    return [];
  }
  return (data ?? []) as GymAnnouncement[];
}

import "server-only";

import { createSupabaseAdminClient, createSupabaseServerClient, hasSupabasePublicEnv } from "@/lib/supabase/server";

export type GymSponsor = {
  id: string;
  name: string;
  description: string;
  url: string | null;
  image_url: string | null;
  is_published: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

const SELECT_COLS =
  "id, name, description, url, image_url, is_published, display_order, created_at, updated_at";

/**
 * Fetches published sponsors for the public /gym page.
 * Uses the user-scoped server client so RLS is applied (is_published = true only).
 * Ordered by display_order ASC, then created_at ASC.
 */
export async function getPublishedSponsors(): Promise<GymSponsor[]> {
  if (!hasSupabasePublicEnv()) return [];

  try {
    const client = createSupabaseServerClient();
    const { data, error } = await client
      .from("gym_sponsors")
      .select(SELECT_COLS)
      .eq("is_published", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("getPublishedSponsors: query failed.", error.message);
      return [];
    }
    return (data ?? []) as GymSponsor[];
  } catch {
    return [];
  }
}

/**
 * Fetches ALL sponsors (including unpublished) for the admin page.
 * Uses the admin client to bypass RLS.
 */
export async function getAllSponsors(): Promise<GymSponsor[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("gym_sponsors")
    .select(SELECT_COLS)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getAllSponsors: query failed.", error.message);
    return [];
  }
  return (data ?? []) as GymSponsor[];
}

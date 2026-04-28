"use server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

/** Returns the authenticated user's ID only when their role is 'admin'. */
async function requireAdminUserId(): Promise<string | null> {
  const client = createSupabaseServerClient();
  const {
    data: { user }
  } = await client.auth.getUser();
  if (!user) return null;

  const { data } = await client
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string }>();

  return data?.role === "admin" ? user.id : null;
}

export type AnnouncementInput = {
  title: string;
  body: string;
  is_published: boolean;
  display_order: number;
};

export async function createAnnouncement(
  input: AnnouncementInput
): Promise<{ ok: boolean; error?: string }> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return { ok: false, error: "forbidden" };

  const title = input.title.trim();
  if (!title) return { ok: false, error: "title_required" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("gym_announcements").insert({
    title,
    body: input.body.trim(),
    is_published: input.is_published,
    display_order: input.display_order,
    published_at: input.is_published ? new Date().toISOString() : null,
    created_by: adminUserId
  });

  if (error) {
    console.error("createAnnouncement: insert failed.", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function updateAnnouncement(
  id: string,
  input: AnnouncementInput
): Promise<{ ok: boolean; error?: string }> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return { ok: false, error: "forbidden" };

  const title = input.title.trim();
  if (!title) return { ok: false, error: "title_required" };

  const admin = createSupabaseAdminClient();

  // Preserve existing published_at if already set; set it now if newly published.
  const { data: existing } = await admin
    .from("gym_announcements")
    .select("published_at, is_published")
    .eq("id", id)
    .maybeSingle<{ published_at: string | null; is_published: boolean }>();

  const publishedAt =
    input.is_published
      ? (existing?.published_at ?? new Date().toISOString())
      : null;

  const { error } = await admin
    .from("gym_announcements")
    .update({
      title,
      body: input.body.trim(),
      is_published: input.is_published,
      display_order: input.display_order,
      published_at: publishedAt
    })
    .eq("id", id);

  if (error) {
    console.error("updateAnnouncement: update failed.", { id, error: error.message });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteAnnouncement(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("gym_announcements")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("deleteAnnouncement: delete failed.", { id, error: error.message });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

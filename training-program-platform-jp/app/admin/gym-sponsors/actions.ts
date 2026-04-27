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

export type SponsorInput = {
  name: string;
  description: string;
  url: string;
  image_url: string;
  is_published: boolean;
  display_order: number;
};

export async function createSponsor(
  input: SponsorInput
): Promise<{ ok: boolean; error?: string }> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return { ok: false, error: "forbidden" };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "name_required" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("gym_sponsors").insert({
    name,
    description: input.description.trim(),
    url: input.url.trim() || null,
    image_url: input.image_url.trim() || null,
    is_published: input.is_published,
    display_order: input.display_order
  });

  if (error) {
    console.error("createSponsor: insert failed.", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function updateSponsor(
  id: string,
  input: SponsorInput
): Promise<{ ok: boolean; error?: string }> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return { ok: false, error: "forbidden" };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "name_required" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("gym_sponsors")
    .update({
      name,
      description: input.description.trim(),
      url: input.url.trim() || null,
      image_url: input.image_url.trim() || null,
      is_published: input.is_published,
      display_order: input.display_order
    })
    .eq("id", id);

  if (error) {
    console.error("updateSponsor: update failed.", { id, error: error.message });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteSponsor(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("gym_sponsors").delete().eq("id", id);

  if (error) {
    console.error("deleteSponsor: delete failed.", { id, error: error.message });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

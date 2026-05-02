"use server";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasSupabasePublicEnv
} from "@/lib/supabase/server";
import type { RequestType } from "@/lib/gym/consultation-types";

export type ConsultationInput = {
  requester_name: string;
  contact: string;
  request_type: RequestType;
  preferred_date: string;
  message: string;
};

export async function submitConsultationRequest(
  input: ConsultationInput
): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabasePublicEnv()) return { ok: false, error: "service_unavailable" };

  const name = input.requester_name.trim();
  if (!name) return { ok: false, error: "name_required" };

  // Get optional user_id from session
  const client = createSupabaseServerClient();
  const {
    data: { user }
  } = await client.auth.getUser();

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("gym_consultation_requests").insert({
    user_id: user?.id ?? null,
    requester_name: name,
    contact: input.contact.trim(),
    request_type: input.request_type,
    preferred_date: input.preferred_date.trim(),
    message: input.message.trim()
  });

  if (error) {
    console.error("submitConsultationRequest: insert failed.", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

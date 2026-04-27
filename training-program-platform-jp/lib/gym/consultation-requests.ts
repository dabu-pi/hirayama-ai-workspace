import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

// Import and re-export shared types + labels so server-side consumers can use one import.
import type { GymConsultationRequest } from "./consultation-types";
export type {
  GymConsultationRequest,
  RequestStatus,
  RequestType
} from "./consultation-types";
export { REQUEST_TYPE_LABELS, STATUS_LABELS } from "./consultation-types";

const SELECT_COLS =
  "id, user_id, requester_name, contact, request_type, preferred_date, message, status, admin_note, created_at, updated_at";

/** Fetches all requests for the admin page, newest first. */
export async function getAllConsultationRequests(): Promise<GymConsultationRequest[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("gym_consultation_requests")
    .select(SELECT_COLS)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAllConsultationRequests: query failed.", error.message);
    return [];
  }
  return (data ?? []) as GymConsultationRequest[];
}

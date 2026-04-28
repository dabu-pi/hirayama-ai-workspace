// Shared types and labels — safe to import in both server and client components.

export type RequestType = "trainer_consultation" | "personal_training" | "other";
export type RequestStatus = "new" | "contacted" | "closed";

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  trainer_consultation: "トレーナー相談",
  personal_training:    "パーソナルトレーニング申込",
  other:                "その他"
};

export const STATUS_LABELS: Record<RequestStatus, string> = {
  new:       "新規",
  contacted: "対応済み",
  closed:    "クローズ"
};

export type GymConsultationRequest = {
  id: string;
  user_id: string | null;
  requester_name: string;
  contact: string;
  request_type: RequestType;
  preferred_date: string;
  message: string;
  status: RequestStatus;
  admin_note: string;
  created_at: string;
  updated_at: string;
};

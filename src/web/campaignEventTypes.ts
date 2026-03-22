export type CampaignEvent = {
  id: string;
  outbound_id: string;
  event_type: string;
  outcome_classification: string | null;
  provider_event_id: string | null;
  occurred_at: string | null;
  created_at: string | null;
  pattern_id: string | null;
  coach_prompt_id: string | null;
  payload: Record<string, unknown> | null;
  draft_id: string | null;
  draft_email_type: string | null;
  draft_status: string | null;
  subject: string | null;
  provider: string | null;
  provider_message_id: string | null;
  sender_identity: string | null;
  sent_at: string | null;
  recipient_email: string | null;
  recipient_email_source: string | null;
  recipient_email_kind: string | null;
  contact_id: string | null;
  contact_name: string | null;
  contact_position: string | null;
  company_id: string | null;
  company_name: string | null;
  company_website: string | null;
};

export type CampaignEventsView = {
  campaign: {
    id: string;
    name: string;
    status?: string;
    segment_id: string;
    segment_version: number;
    created_at?: string | null;
    updated_at?: string | null;
  };
  events: CampaignEvent[];
};

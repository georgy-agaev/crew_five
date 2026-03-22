import { useEffect, useMemo, useState } from 'react';

import type { CampaignAuditView } from '../apiClient';

const issueOrder = [
  'snapshot_contacts_without_draft',
  'drafts_missing_recipient_email',
  'duplicate_drafts',
  'draft_company_mismatches',
  'sent_drafts_without_outbound',
  'outbounds_without_draft',
  'outbounds_missing_recipient_email',
] as const;

type IssueKey = (typeof issueOrder)[number];

const issueLabels: Record<IssueKey, string> = {
  snapshot_contacts_without_draft: 'Missing drafts',
  drafts_missing_recipient_email: 'Drafts missing recipient',
  duplicate_drafts: 'Duplicate drafts',
  draft_company_mismatches: 'Draft/company mismatch',
  sent_drafts_without_outbound: 'Sent drafts without outbound',
  outbounds_without_draft: 'Outbounds without draft',
  outbounds_missing_recipient_email: 'Outbounds missing recipient',
};

function formatIssueHeadline(row: Record<string, unknown>) {
  return (
    (typeof row.contact_name === 'string' && row.contact_name) ||
    (typeof row.company_name === 'string' && row.company_name) ||
    (typeof row.recipient_email === 'string' && row.recipient_email) ||
    (typeof row.draft_id === 'string' && row.draft_id) ||
    (typeof row.outbound_id === 'string' && row.outbound_id) ||
    'Issue row'
  );
}

function formatIssueDetail(row: Record<string, unknown>) {
  const parts = [
    typeof row.contact_position === 'string' ? row.contact_position : null,
    typeof row.company_name === 'string' ? row.company_name : null,
    typeof row.email_type === 'string' ? row.email_type : null,
    typeof row.status === 'string' ? row.status : null,
    typeof row.recipient_email === 'string' ? row.recipient_email : null,
  ].filter((value): value is string => Boolean(value && value.trim()));

  if (parts.length > 0) {
    return parts.join(' · ');
  }

  const ids = [
    typeof row.contact_id === 'string' ? `contact ${row.contact_id}` : null,
    typeof row.draft_id === 'string' ? `draft ${row.draft_id}` : null,
    typeof row.outbound_id === 'string' ? `outbound ${row.outbound_id}` : null,
  ].filter((value): value is string => Boolean(value));

  return ids.join(' · ') || 'No extra detail';
}

export function getCampaignAuditIssueBuckets(audit: CampaignAuditView | null) {
  if (!audit) {
    return issueOrder.map((key) => ({ key, label: issueLabels[key], count: 0 }));
  }

  return issueOrder.map((key) => ({
    key,
    label: issueLabels[key],
    count: audit.issues[key].length,
  }));
}

export function CampaignAuditPanel({ audit }: { audit: CampaignAuditView | null }) {
  const issueBuckets = useMemo(() => getCampaignAuditIssueBuckets(audit), [audit]);
  const [activeIssueKey, setActiveIssueKey] = useState<IssueKey>('snapshot_contacts_without_draft');

  useEffect(() => {
    const firstNonEmpty = issueBuckets.find((bucket) => bucket.count > 0);
    setActiveIssueKey(firstNonEmpty?.key ?? 'snapshot_contacts_without_draft');
  }, [issueBuckets]);

  if (!audit) {
    return null;
  }

  const activeRows = audit.issues[activeIssueKey];

  return (
    <div style={{ marginTop: 18 }}>
      <div className="card__header">
        <div>
          <h4>Audit coverage</h4>
          <p className="muted small">
            Validate snapshot coverage, drafts, outbounds, and issue buckets for this campaign.
          </p>
        </div>
      </div>

      <div className="grid two-column" style={{ alignItems: 'start' }}>
        <div className="panel" style={{ marginTop: 0 }}>
          <div className="panel__title">Coverage summary</div>
          <div className="panel__content">
            <div className="pill-row">
              <span className="pill">{audit.summary.company_count} companies</span>
              <span className="pill">{audit.summary.snapshot_contact_count} snapshot contacts</span>
              <span className="pill pill--accent">{audit.summary.contacts_with_any_draft} with drafts</span>
              <span className="pill">{audit.summary.contacts_with_sent_outbound} sent</span>
              <span className="pill">{audit.summary.contacts_with_events} with events</span>
            </div>
            <div className="pill-row" style={{ marginTop: 10 }}>
              <span className="pill">{audit.summary.draft_count} drafts</span>
              <span className="pill pill--accent">{audit.summary.approved_draft_count} approved</span>
              <span className="pill pill--warn">{audit.summary.rejected_draft_count} rejected</span>
              <span className="pill">{audit.summary.outbound_count} outbounds</span>
              <span className="pill">{audit.summary.event_count} events</span>
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 0 }}>
          <div className="panel__title">Issue buckets</div>
          <div className="panel__content">
            <div className="pill-row">
              {issueBuckets.map((bucket) => (
                <button
                  key={bucket.key}
                  type="button"
                  className={`tab ${activeIssueKey === bucket.key ? 'active' : ''}`}
                  style={{ margin: 0 }}
                  onClick={() => setActiveIssueKey(bucket.key)}
                >
                  {bucket.label}: {bucket.count}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel__title">
          {issueLabels[activeIssueKey]} ({activeRows.length})
        </div>
        <div className="panel__content">
          <div className="table-lite">
            <div className="table-lite__head">
              <span>Issue</span>
              <span>Detail</span>
            </div>
            {activeRows.slice(0, 25).map((row, index) => (
              <div
                key={`${String(row.draft_id ?? row.outbound_id ?? row.contact_id ?? index)}`}
                className="table-lite__row"
              >
                <span>
                  <strong>{formatIssueHeadline(row)}</strong>
                </span>
                <span className="muted small">{formatIssueDetail(row)}</span>
              </div>
            ))}
            {activeRows.length === 0 && (
              <div className="table-lite__row">No rows in this issue bucket.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CampaignAuditPanel;

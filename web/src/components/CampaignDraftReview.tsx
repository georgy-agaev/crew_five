import { useEffect, useMemo, useState } from 'react';

import type { DraftRow } from '../apiClient';
import {
  draftReviewReasonOptions,
  getDraftReviewReasonLabel,
  isDraftReviewReasonCode,
  type DraftReviewReasonCode,
} from '../draftReviewReasons';

export const draftReviewFilters = ['all', 'generated', 'approved', 'rejected', 'sent'] as const;

export type DraftReviewFilter = (typeof draftReviewFilters)[number];

export function getDraftReviewMetadata(draft: DraftRow) {
  const metadata = draft.metadata ?? {};
  const primaryCode = isDraftReviewReasonCode(metadata.review_reason_code) ? metadata.review_reason_code : null;
  const reasonCodes = Array.isArray(metadata.review_reason_codes)
    ? metadata.review_reason_codes.filter((value): value is DraftReviewReasonCode => isDraftReviewReasonCode(value))
    : primaryCode
      ? [primaryCode]
      : [];
  const reasonText = typeof metadata.review_reason_text === 'string' ? metadata.review_reason_text.trim() : '';
  const reviewedAt = typeof metadata.reviewed_at === 'string' ? metadata.reviewed_at : null;
  const reviewedBy = typeof metadata.reviewed_by === 'string' ? metadata.reviewed_by : null;

  return {
    primaryCode,
    primaryLabel: getDraftReviewReasonLabel(primaryCode),
    reasonCodes,
    reasonText,
    reviewedAt,
    reviewedBy,
  };
}

export function summarizeDraftStatuses(drafts: DraftRow[]) {
  return {
    total: drafts.length,
    generated: drafts.filter((draft) => draft.status === 'generated').length,
    approved: drafts.filter((draft) => draft.status === 'approved').length,
    rejected: drafts.filter((draft) => draft.status === 'rejected').length,
    sent: drafts.filter((draft) => draft.status === 'sent').length,
  };
}

export function getDraftPatternLabel(draft: DraftRow) {
  const metadataPattern = draft.metadata?.draft_pattern;
  if (typeof metadataPattern === 'string' && metadataPattern.trim()) {
    return metadataPattern.trim();
  }
  if (typeof draft.pattern_mode === 'string' && draft.pattern_mode.trim()) {
    return draft.pattern_mode.trim();
  }
  return 'n/a';
}

function formatDraftStatus(status?: string | null) {
  if (status === 'generated') return 'generated';
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (status === 'sent') return 'sent';
  return 'n/a';
}

function DraftStatusPill({ status }: { status?: string | null }) {
  const normalized = formatDraftStatus(status);
  const className =
    normalized === 'approved' || normalized === 'sent'
      ? 'pill pill--accent'
      : normalized === 'rejected'
        ? 'pill pill--warn'
        : 'pill pill--subtle';

  return <span className={className}>{normalized}</span>;
}

function ReviewActionButtons({
  draft,
  busy,
  onApprove,
  onBeginReject,
}: {
  draft: DraftRow;
  busy: boolean;
  onApprove: (draftId: string) => void;
  onBeginReject: (draftId: string) => void;
}) {
  if (draft.status === 'sent') {
    return <span className="muted small">Sent drafts are locked.</span>;
  }

  return (
    <div className="pill-row" style={{ marginTop: 12 }}>
      <button
        type="button"
        disabled={busy}
        onClick={() => onApprove(draft.id)}
      >
        Approve
      </button>
      <button
        type="button"
        className="ghost"
        disabled={busy}
        onClick={() => onBeginReject(draft.id)}
      >
        Reject
      </button>
    </div>
  );
}

export function CampaignDraftReview({
  drafts,
  selectedDraftId,
  onSelectDraft,
  activeFilter,
  onFilterChange,
  reviewBusyId,
  onReview,
  linkedOutbound,
  linkedEvent,
  onOpenOutbound,
  onOpenEvent,
}: {
  drafts: DraftRow[];
  selectedDraftId: string;
  onSelectDraft: (draftId: string) => void;
  activeFilter: DraftReviewFilter;
  onFilterChange: (status: DraftReviewFilter) => void;
  reviewBusyId: string | null;
  onReview: (
    draftId: string,
    review: {
      status: 'approved' | 'rejected';
      metadata?: Record<string, unknown>;
    }
  ) => Promise<void> | void;
  linkedOutbound?: { id: string; status?: string | null } | null;
  linkedEvent?: { id: string; event_type?: string | null } | null;
  onOpenOutbound?: (outboundId: string) => void;
  onOpenEvent?: (eventId: string) => void;
}) {
  const summary = useMemo(() => summarizeDraftStatuses(drafts), [drafts]);
  const filteredDrafts = useMemo(() => {
    if (activeFilter === 'all') {
      return drafts;
    }
    return drafts.filter((draft) => draft.status === activeFilter);
  }, [activeFilter, drafts]);

  const selectedDraft =
    filteredDrafts.find((draft) => draft.id === selectedDraftId) ?? filteredDrafts[0] ?? null;
  const selectedDraftReview = selectedDraft ? getDraftReviewMetadata(selectedDraft) : null;
  const [rejectDraftId, setRejectDraftId] = useState<string | null>(null);
  const [rejectReasonCode, setRejectReasonCode] = useState<DraftReviewReasonCode | ''>('');
  const [rejectReasonText, setRejectReasonText] = useState('');
  const [rejectExtraCodes, setRejectExtraCodes] = useState<DraftReviewReasonCode[]>([]);
  const [rejectValidationError, setRejectValidationError] = useState<string | null>(null);

  useEffect(() => {
    setRejectDraftId(null);
    setRejectReasonCode('');
    setRejectReasonText('');
    setRejectExtraCodes([]);
    setRejectValidationError(null);
  }, [selectedDraft?.id]);

  const handleApprove = async (draftId: string) => {
    await onReview(draftId, { status: 'approved' });
  };

  const handleBeginReject = (draftId: string) => {
    setRejectDraftId(draftId);
    setRejectReasonCode('');
    setRejectReasonText('');
    setRejectExtraCodes([]);
    setRejectValidationError(null);
  };

  const toggleRejectExtraCode = (code: DraftReviewReasonCode) => {
    setRejectExtraCodes((current) =>
      current.includes(code) ? current.filter((value) => value !== code) : [...current, code]
    );
  };

  const handleRejectSubmit = async () => {
    if (!selectedDraft || rejectDraftId !== selectedDraft.id) {
      return;
    }
    if (!rejectReasonCode) {
      setRejectValidationError('Pick a rejection reason before saving.');
      return;
    }
    if (rejectReasonCode === 'other' && rejectReasonText.trim().length === 0) {
      setRejectValidationError('Add a note when using the "Other" rejection reason.');
      return;
    }

    const reasonCodes = Array.from(new Set([rejectReasonCode, ...rejectExtraCodes.filter((code) => code !== rejectReasonCode)]));

    try {
      await onReview(selectedDraft.id, {
        status: 'rejected',
        metadata: {
          review_reason_code: rejectReasonCode,
          review_reason_codes: reasonCodes,
          review_reason_text: rejectReasonText.trim() || undefined,
        },
      });
      setRejectDraftId(null);
      setRejectReasonCode('');
      setRejectReasonText('');
      setRejectExtraCodes([]);
      setRejectValidationError(null);
    } catch {
      // Keep the form open so the operator can retry after the outer error alert is shown.
    }
  };

  return (
    <div style={{ marginTop: 18 }}>
      <div className="card__header">
        <div>
          <h4>Draft review</h4>
          <p className="muted small">Review subject, body, recipient context, and approve or reject drafts.</p>
        </div>
        <div className="pill-row" style={{ marginTop: 0 }}>
          <span className="pill">{summary.total} total</span>
          <span className="pill pill--subtle">{summary.generated} generated</span>
          <span className="pill pill--accent">{summary.approved} approved</span>
          <span className="pill pill--warn">{summary.rejected} rejected</span>
          <span className="pill">{summary.sent} sent</span>
        </div>
      </div>

      <div className="tabbar" style={{ marginTop: 0, marginBottom: 12 }}>
        {draftReviewFilters.map((filter) => (
          <button
            key={filter}
            type="button"
            className={`tab ${activeFilter === filter ? 'active' : ''}`}
            onClick={() => onFilterChange(filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="grid two-column" style={{ alignItems: 'start' }}>
        <div className="panel" style={{ marginTop: 0 }}>
          <div className="panel__title">Drafts in review queue</div>
          <div className="panel__content">
            <div className="table-lite">
              <div className="table-lite__head">
                <span>Contact</span>
                <span>Type</span>
                <span>Recipient</span>
                <span>Status</span>
              </div>
              {filteredDrafts.map((draft) => (
                <button
                  key={draft.id}
                  type="button"
                  className="table-lite__row"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background:
                      draft.id === selectedDraft?.id ? 'rgba(15, 23, 42, 0.06)' : 'transparent',
                    color: 'inherit',
                    border: 'none',
                    borderRadius: 0,
                    boxShadow: 'none',
                    transform: 'none',
                    padding: '12px 14px',
                  }}
                  onClick={() => onSelectDraft(draft.id)}
                >
                  <span>
                    <strong>{draft.contact_name ?? draft.contact_id ?? 'Unknown contact'}</strong>
                    <br />
                    <span className="muted small">{draft.company_name ?? 'Unknown company'}</span>
                  </span>
                  <span>{draft.email_type ?? 'intro'}</span>
                  <span>
                    {draft.recipient_email ?? 'Missing recipient'}
                    <br />
                    <span className="muted small">{draft.recipient_email_source ?? 'n/a'}</span>
                  </span>
                  <span>{formatDraftStatus(draft.status)}</span>
                </button>
              ))}
              {filteredDrafts.length === 0 && (
                <div className="table-lite__row">No drafts match this filter yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 0 }}>
          <div className="panel__title">Selected draft</div>
          <div className="panel__content">
            {!selectedDraft ? (
              <p className="muted small">Select a draft to review its subject, body, and recipient context.</p>
            ) : (
              <>
                <div className="pill-row" style={{ marginTop: 0 }}>
                  <DraftStatusPill status={selectedDraft.status} />
                  <span className="pill">{selectedDraft.email_type ?? 'intro'}</span>
                  <span className="pill">{getDraftPatternLabel(selectedDraft)}</span>
                  <span className={`pill ${selectedDraft.sendable ? '' : 'pill--warn'}`}>
                    {selectedDraft.sendable ? 'sendable' : 'needs recipient fix'}
                  </span>
                </div>

                <div style={{ marginTop: 14 }}>
                  <strong>{selectedDraft.subject ?? 'No subject'}</strong>
                  <div className="muted small" style={{ marginTop: 6 }}>
                    {selectedDraft.contact_name ?? 'Unknown contact'}
                    {' · '}
                    {selectedDraft.contact_position ?? 'Unknown role'}
                    {' · '}
                    {selectedDraft.company_name ?? 'Unknown company'}
                  </div>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    To: {selectedDraft.recipient_email ?? 'Missing recipient'}
                    {' · '}
                    Source: {selectedDraft.recipient_email_source ?? 'n/a'}
                    {' · '}
                    Kind: {selectedDraft.recipient_email_kind ?? 'n/a'}
                  </div>
                </div>

                <div className="pill-row" style={{ marginTop: 12 }}>
                  <span className="pill">Trace</span>
                  {linkedOutbound ? (
                    <button type="button" className="ghost" onClick={() => onOpenOutbound?.(linkedOutbound.id)}>
                      Open outbound
                    </button>
                  ) : (
                    <span className="pill pill--subtle">No outbound yet</span>
                  )}
                  {linkedEvent ? (
                    <button type="button" className="ghost" onClick={() => onOpenEvent?.(linkedEvent.id)}>
                      Open event
                    </button>
                  ) : (
                    <span className="pill pill--subtle">No event yet</span>
                  )}
                </div>

                {selectedDraftReview?.primaryCode && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: '12px 14px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      background: '#fff',
                    }}
                  >
                    <div className="muted small" style={{ marginBottom: 8 }}>
                      Review metadata
                    </div>
                    <div className="pill-row" style={{ marginTop: 0 }}>
                      <span className="pill pill--warn">{selectedDraftReview.primaryLabel ?? selectedDraftReview.primaryCode}</span>
                      {selectedDraftReview.reasonCodes
                        .filter((code) => code !== selectedDraftReview.primaryCode)
                        .map((code) => (
                          <span key={code} className="pill pill--subtle">
                            {getDraftReviewReasonLabel(code) ?? code}
                          </span>
                        ))}
                    </div>
                    {selectedDraftReview.reasonText && (
                      <div className="muted small" style={{ marginTop: 8 }}>
                        {selectedDraftReview.reasonText}
                      </div>
                    )}
                    {(selectedDraftReview.reviewedAt || selectedDraftReview.reviewedBy) && (
                      <div className="muted small" style={{ marginTop: 8 }}>
                        Reviewed
                        {selectedDraftReview.reviewedBy ? ` by ${selectedDraftReview.reviewedBy}` : ''}
                        {selectedDraftReview.reviewedAt ? ` at ${selectedDraftReview.reviewedAt}` : ''}
                      </div>
                    )}
                  </div>
                )}

                <div
                  style={{
                    marginTop: 14,
                    padding: '12px 14px',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    background: '#fff',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.65,
                  }}
                >
                  {selectedDraft.body ?? 'No body generated yet.'}
                </div>

                <ReviewActionButtons
                  draft={selectedDraft}
                  busy={reviewBusyId === selectedDraft.id}
                  onApprove={handleApprove}
                  onBeginReject={handleBeginReject}
                />

                {rejectDraftId === selectedDraft.id && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: '12px 14px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      background: '#fff',
                    }}
                  >
                    <div className="muted small" style={{ marginBottom: 8 }}>
                      Reject reason
                    </div>
                    <label style={{ marginBottom: 12 }}>
                      Primary reason
                      <select
                        aria-label="Primary rejection reason"
                        value={rejectReasonCode}
                        onChange={(event) => {
                          const nextCode = event.target.value;
                          setRejectReasonCode(isDraftReviewReasonCode(nextCode) ? nextCode : '');
                          setRejectValidationError(null);
                        }}
                      >
                        <option value="">Select a reason</option>
                        {draftReviewReasonOptions.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="muted small" style={{ marginBottom: 8 }}>
                      Additional tags
                    </div>
                    <div className="pill-row" style={{ marginTop: 0 }}>
                      {draftReviewReasonOptions
                        .filter((option) => option.code !== rejectReasonCode)
                        .map((option) => (
                          <button
                            key={option.code}
                            type="button"
                            className={rejectExtraCodes.includes(option.code) ? '' : 'ghost'}
                            onClick={() => toggleRejectExtraCode(option.code)}
                            title={option.description}
                          >
                            {option.label}
                          </button>
                        ))}
                    </div>

                    <label style={{ marginTop: 12, marginBottom: 0 }}>
                      Review note
                      <textarea
                        aria-label="Rejection review note"
                        rows={4}
                        placeholder='Explain the rejection. Required for "Other".'
                        value={rejectReasonText}
                        onChange={(event) => {
                          setRejectReasonText(event.target.value);
                          setRejectValidationError(null);
                        }}
                      />
                    </label>

                    {rejectValidationError && (
                      <div className="small" style={{ marginTop: 8 }}>
                        {rejectValidationError}
                      </div>
                    )}

                    <div className="pill-row" style={{ marginTop: 12 }}>
                      <button type="button" className="ghost" onClick={() => setRejectDraftId(null)}>
                        Cancel
                      </button>
                      <button type="button" disabled={reviewBusyId === selectedDraft.id} onClick={handleRejectSubmit}>
                        Save rejection
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CampaignDraftReview;

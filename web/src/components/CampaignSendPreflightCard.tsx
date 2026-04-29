import { useEffect, useState } from 'react';
import {
  fetchCampaignSendPreflight,
  triggerCampaignSendExecution,
  type CampaignSendExecutionResult,
  type CampaignSendPreflightIssue,
  type CampaignSendPreflightView,
} from '../apiClient';

// ============================================================
// i18n
// ============================================================

const translations: Record<string, Record<string, string>> = {
  en: {
    title: 'Send preflight',
    readyToSend: 'Ready to send',
    blocked: 'Blocked',
    drafts: 'Drafts',
    approved: 'Approved',
    sendable: 'Sendable',
    generated: 'Generated',
    rejected: 'Rejected',
    sent: 'Sent',
    missingEmail: 'Missing email',
    suppressed: 'Suppressed',
    issues: 'Issues',
    allIssues: 'All issues',
    generatedIssue: 'Needs review',
    missingEmailIssue: 'Missing email',
    suppressedIssue: 'Suppressed',
    alreadySentIssue: 'Already sent',
    sentEvidencePrefix: 'Sent in',
    noIssues: 'No preflight issues',
    unknownContact: 'Unknown contact',
    noSubject: 'No subject',
    senderPlan: 'Sender plan',
    senders: 'senders',
    domains: 'Domains',
    noSender: 'No sender assigned',
    sendNow: 'Send now',
    sending: 'Sending...',
    sendFailed: 'Send failed',
    sentLabel: 'sent',
    failedLabel: 'failed',
    skippedLabel: 'skipped',
    selectCampaign: 'Select a campaign to inspect send readiness',
    loading: 'Loading...',
    error: 'Failed to load preflight',
  },
  ru: {
    title: 'Проверка отправки',
    readyToSend: 'Готово к отправке',
    blocked: 'Заблокировано',
    drafts: 'Письма',
    approved: 'Одобрено',
    sendable: 'Готово',
    generated: 'Генерировано',
    rejected: 'Отклонено',
    sent: 'Отправлено',
    missingEmail: 'Нет email',
    suppressed: 'Подавлено',
    issues: 'Проблемы',
    allIssues: 'Все проблемы',
    generatedIssue: 'Нужна проверка',
    missingEmailIssue: 'Нет email',
    suppressedIssue: 'Подавлено',
    alreadySentIssue: 'Уже отправляли',
    sentEvidencePrefix: 'Отправлено в',
    noIssues: 'Проблем нет',
    unknownContact: 'Контакт неизвестен',
    noSubject: 'Без темы',
    senderPlan: 'Отправители',
    senders: 'отправителей',
    domains: 'Домены',
    noSender: 'Отправитель не назначен',
    sendNow: 'Отправить сейчас',
    sending: 'Отправка...',
    sendFailed: 'Ошибка отправки',
    sentLabel: 'отправлено',
    failedLabel: 'ошибок',
    skippedLabel: 'пропущено',
    selectCampaign: 'Выберите кампанию для проверки',
    loading: 'Загрузка...',
    error: 'Ошибка загрузки',
  },
};

function getT(language: string): Record<string, string> {
  return translations[language] ?? translations['en'];
}

type IssueFilter = 'all' | CampaignSendPreflightIssue['code'];

function getIssueLabel(t: Record<string, string>, code: CampaignSendPreflightIssue['code']) {
  if (code === 'generated_not_reviewed') return t.generatedIssue;
  if (code === 'missing_recipient_email') return t.missingEmailIssue;
  if (code === 'suppressed_contact') return t.suppressedIssue;
  if (code === 'intro_already_sent') return t.alreadySentIssue;
  return code;
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  return value.slice(0, 10);
}

function getIssueEvidenceText(t: Record<string, string>, issue: CampaignSendPreflightIssue) {
  if (issue.code !== 'intro_already_sent') {
    return null;
  }
  const campaign = issue.relatedCampaignName || issue.relatedCampaignId;
  const sentAt = formatDate(issue.relatedSentAt);
  if (!campaign && !sentAt) {
    return null;
  }
  const source = campaign ? `${t.sentEvidencePrefix} ${campaign}` : t.sentEvidencePrefix;
  return [source, sentAt].filter(Boolean).join(' · ');
}

// ============================================================
// Component
// ============================================================

export function CampaignSendPreflightCard({
  campaignId,
  compact = false,
  language = 'en',
}: {
  campaignId?: string;
  compact?: boolean;
  language?: string;
}) {
  const t = getT(language);
  const [data, setData] = useState<CampaignSendPreflightView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<CampaignSendExecutionResult | null>(null);
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('all');

  useEffect(() => {
    if (!campaignId) {
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchCampaignSendPreflight(campaignId)
      .then((view) => {
        if (!cancelled) setData(view);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? t.error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [campaignId]);

  // ---- No campaign selected ----
  if (!campaignId) {
    return (
      <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
        <h3 className="od-context-block__title">{t.title}</h3>
        <span style={{ fontSize: 12, color: 'var(--od-text-muted)' }}>{t.selectCampaign}</span>
      </div>
    );
  }

  // ---- Loading ----
  if (loading && !data) {
    return (
      <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
        <h3 className="od-context-block__title">{t.title}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="od-skeleton" style={{ height: 14, width: '60%' }} />
          <span className="od-skeleton" style={{ height: 12, width: '40%' }} />
          <span className="od-skeleton" style={{ height: 12, width: '50%' }} />
        </div>
      </div>
    );
  }

  // ---- Error ----
  if (error) {
    return (
      <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
        <h3 className="od-context-block__title">{t.title}</h3>
        <span style={{ fontSize: 12, color: 'var(--od-error)' }}>{error}</span>
      </div>
    );
  }

  if (!data) return null;

  const { readyToSend, blockers, summary, senderPlan, issues = [] } = data;
  const issueCounts = issues.reduce(
    (acc, issue) => {
      acc[issue.code] = (acc[issue.code] ?? 0) + 1;
      return acc;
    },
    {} as Record<CampaignSendPreflightIssue['code'], number>
  );
  const issueFilters: Array<{ key: IssueFilter; label: string; count: number }> = [
    { key: 'all', label: t.allIssues, count: issues.length },
    { key: 'generated_not_reviewed', label: t.generatedIssue, count: issueCounts.generated_not_reviewed ?? 0 },
    { key: 'missing_recipient_email', label: t.missingEmailIssue, count: issueCounts.missing_recipient_email ?? 0 },
    { key: 'suppressed_contact', label: t.suppressedIssue, count: issueCounts.suppressed_contact ?? 0 },
    { key: 'intro_already_sent', label: t.alreadySentIssue, count: issueCounts.intro_already_sent ?? 0 },
  ].filter((item) => item.key === 'all' || item.count > 0);
  const visibleIssues = issueFilter === 'all' ? issues : issues.filter((issue) => issue.code === issueFilter);

  const handleSendNow = async () => {
    if (!campaignId || sendLoading) return;
    setSendLoading(true);
    setSendError(null);
    try {
      const result = await triggerCampaignSendExecution(campaignId, {
        reason: 'auto_send_mixed',
        batchLimit: Math.max(1, senderPlan.assignmentCount || 1),
      });
      setSendResult(result);
      const refreshed = await fetchCampaignSendPreflight(campaignId);
      setData(refreshed);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : t.sendFailed);
    } finally {
      setSendLoading(false);
    }
  };

  return (
    <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
      <h3 className="od-context-block__title">{t.title}</h3>

      {/* Readiness badge */}
      <div style={{ marginBottom: 8 }}>
        {readyToSend ? (
          <span
            className="od-count-chip"
            style={{
              background: 'color-mix(in srgb, var(--od-success) 14%, transparent)',
              color: 'var(--od-success)',
              fontWeight: 600,
            }}
          >
            {t.readyToSend}
          </span>
        ) : (
          <span
            className="od-count-chip"
            style={{
              background: 'color-mix(in srgb, var(--od-warning) 14%, transparent)',
              color: 'var(--od-warning)',
              fontWeight: 600,
            }}
          >
            {t.blocked}
          </span>
        )}
      </div>

      {/* Blockers (first per UX rules) */}
      {blockers.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {blockers.map((b) => (
            <div
              key={b.code}
              style={{
                fontSize: 12,
                lineHeight: 1.6,
                color: 'var(--od-error)',
                display: 'flex',
                gap: 6,
                alignItems: 'baseline',
              }}
            >
              <span style={{ flexShrink: 0 }}>&#x2716;</span>
              <span>{b.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Summary counters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: compact ? 0 : 8 }}>
        <span className="od-count-chip" title={t.drafts}>
          {summary.draftCount} {t.drafts.toLowerCase()}
        </span>
        <span className="od-count-chip" title={t.approved}>
          {summary.approvedDraftCount} {t.approved.toLowerCase()}
        </span>
        <span className="od-count-chip" title={t.sendable}>
          {summary.sendableApprovedDraftCount} {t.sendable.toLowerCase()}
        </span>
        {summary.generatedDraftCount > 0 && (
          <span className="od-count-chip" title={t.generated}>
            {summary.generatedDraftCount} {t.generated.toLowerCase()}
          </span>
        )}
        {summary.rejectedDraftCount > 0 && (
          <span className="od-count-chip" title={t.rejected}>
            {summary.rejectedDraftCount} {t.rejected.toLowerCase()}
          </span>
        )}
        {summary.sentDraftCount > 0 && (
          <span className="od-count-chip" title={t.sent}>
            {summary.sentDraftCount} {t.sent.toLowerCase()}
          </span>
        )}
        {summary.approvedMissingRecipientEmailCount > 0 && (
          <span
            className="od-count-chip"
            title={t.missingEmail}
            style={{ color: 'var(--od-warning)' }}
          >
            {summary.approvedMissingRecipientEmailCount} {t.missingEmail.toLowerCase()}
          </span>
        )}
        {summary.approvedSuppressedContactCount > 0 && (
          <span
            className="od-count-chip"
            title={t.suppressed}
            style={{ color: 'var(--od-error)' }}
          >
            {summary.approvedSuppressedContactCount} {t.suppressed.toLowerCase()}
          </span>
        )}
      </div>

      {!compact && (
        <div style={{ marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => { void handleSendNow(); }}
            disabled={!readyToSend || sendLoading}
            style={{
              minHeight: 28,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid var(--od-border)',
              background: readyToSend ? 'var(--od-success)' : 'var(--od-card)',
              color: readyToSend ? '#fff' : 'var(--od-text-muted)',
              fontSize: 12,
              fontWeight: 600,
              cursor: readyToSend && !sendLoading ? 'pointer' : 'not-allowed',
              opacity: sendLoading ? 0.8 : 1,
            }}
          >
            {sendLoading ? t.sending : t.sendNow}
          </button>
          {sendError && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--od-error)' }}>{sendError}</div>
          )}
          {sendResult && !sendError && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--od-text-muted)' }}>
              {`${sendResult.sentCount ?? sendResult.triggered ?? 0} ${t.sentLabel} · ${
                sendResult.failedCount ?? 0
              } ${t.failedLabel} · ${sendResult.skippedCount ?? 0} ${t.skippedLabel}`}
            </div>
          )}
        </div>
      )}

      {!compact && issues.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div className="od-context-row" style={{ marginBottom: 6 }}>
            <span className="od-context-row__label">{t.issues}</span>
            <span className="od-context-row__value">{issues.length}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {issueFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className="od-count-chip"
                onClick={() => setIssueFilter(filter.key)}
                style={{
                  border: issueFilter === filter.key ? '1px solid var(--od-orange)' : undefined,
                  color: issueFilter === filter.key ? 'var(--od-orange)' : undefined,
                  cursor: 'pointer',
                }}
              >
                {filter.label} {filter.count}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflow: 'auto' }}>
            {visibleIssues.map((issue) => (
              <div
                key={`${issue.code}-${issue.draftId}`}
                style={{
                  border: '1px solid var(--od-border)',
                  borderRadius: 8,
                  padding: '7px 8px',
                  background: 'var(--od-card)',
                }}
              >
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="od-count-chip" style={{ color: 'var(--od-warning)' }}>
                    {getIssueLabel(t, issue.code)}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--od-text)' }}>
                    {issue.contactName || t.unknownContact}
                  </span>
                  {issue.contactPosition && (
                    <span style={{ fontSize: 11, color: 'var(--od-text-muted)' }}>{issue.contactPosition}</span>
                  )}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--od-text-muted)' }}>
                  {issue.subject || t.noSubject}
                </div>
                <div style={{ marginTop: 3, fontSize: 11, color: 'var(--od-text-muted)' }}>
                  {issue.workEmail || issue.genericEmail || issue.draftId}
                </div>
                {getIssueEvidenceText(t, issue) && (
                  <div style={{ marginTop: 3, fontSize: 11, color: 'var(--od-orange)' }}>
                    {getIssueEvidenceText(t, issue)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sender plan */}
      {!compact && (
        <div style={{ marginTop: 4 }}>
          <div className="od-context-row">
            <span className="od-context-row__label">{t.senderPlan}</span>
            <span className="od-context-row__value">
              {senderPlan.assignmentCount > 0
                ? `${senderPlan.assignmentCount} ${t.senders}`
                : t.noSender}
            </span>
          </div>
          {senderPlan.domains.length > 0 && (
            <div className="od-context-row">
              <span className="od-context-row__label">{t.domains}</span>
              <span className="od-context-row__value">{senderPlan.domains.join(', ')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

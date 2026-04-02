import { useEffect, useState } from 'react';
import {
  fetchCampaignAudit,
  fetchCampaignEvents,
  fetchCampaignFollowupCandidates,
  type CampaignAuditView,
  type CampaignEvent,
  type CampaignFollowupCandidatesView,
} from '../apiClient';

const translations: Record<string, Record<string, string>> = {
  en: {
    title: 'Execution',
    sent: 'Sent',
    delivered: 'Delivered',
    bounced: 'Bounced',
    bounceRate: 'bounce rate',
    replies: 'Replies',
    replyRate: 'reply rate',
    positive: 'positive',
    negative: 'negative',
    autoReply: 'auto-reply',
    unclassified: 'unclassified',
    unsubscribed: 'Unsubscribed',
    followUp: 'Follow-up ready',
    coverage: 'Coverage',
    contactsWithDraft: 'with drafts',
    contactsWithoutDraft: 'no draft yet',
    selectCampaign: 'Select a campaign',
  },
  ru: {
    title: 'Выполнение',
    sent: 'Отправлено',
    delivered: 'Доставлено',
    bounced: 'Баунс',
    bounceRate: 'bounce rate',
    replies: 'Ответы',
    replyRate: 'reply rate',
    positive: 'позитивных',
    negative: 'негативных',
    autoReply: 'авто-ответ',
    unclassified: 'не кл.',
    unsubscribed: 'Отписки',
    followUp: 'Готовы к follow-up',
    coverage: 'Покрытие',
    contactsWithDraft: 'с письмами',
    contactsWithoutDraft: 'без письма',
    selectCampaign: 'Выберите кампанию',
  },
};

function getT(language: string) {
  return translations[language] ?? translations['en'];
}

function pct(n: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}

export function CampaignExecutionSummaryCard({
  campaignId,
  language = 'en',
}: {
  campaignId?: string;
  language?: string;
}) {
  const t = getT(language);
  const [audit, setAudit] = useState<CampaignAuditView | null>(null);
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [followup, setFollowup] = useState<CampaignFollowupCandidatesView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) {
      setAudit(null);
      setEvents([]);
      setFollowup(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchCampaignAudit(campaignId).catch(() => null),
      fetchCampaignEvents(campaignId).catch(() => ({ events: [] as CampaignEvent[] })),
      fetchCampaignFollowupCandidates(campaignId).catch(() => null),
    ]).then(([auditData, eventsData, followupData]) => {
      if (cancelled) return;
      setAudit(auditData);
      setEvents(eventsData?.events ?? []);
      setFollowup(followupData);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [campaignId]);

  if (!campaignId) {
    return (
      <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
        <h3 className="od-context-block__title">{t.title}</h3>
        <span style={{ fontSize: 12, color: 'var(--od-text-muted)' }}>{t.selectCampaign}</span>
      </div>
    );
  }

  if (loading && !audit) {
    return (
      <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
        <h3 className="od-context-block__title">{t.title}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="od-skeleton" style={{ height: 14, width: '55%' }} />
          <span className="od-skeleton" style={{ height: 12, width: '40%' }} />
          <span className="od-skeleton" style={{ height: 12, width: '60%' }} />
        </div>
      </div>
    );
  }

  if (error && !audit) {
    return (
      <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
        <h3 className="od-context-block__title">{t.title}</h3>
        <span style={{ fontSize: 12, color: 'var(--od-error)' }}>{error}</span>
      </div>
    );
  }

  if (!audit) return null;

  const s = audit.summary;
  const sentCount = s.outbound_sent_count;
  const bouncedCount = s.bounced_event_count;
  const deliveredCount = sentCount - bouncedCount;
  const repliedCount = s.replied_event_count;
  const unsubCount = s.unsubscribed_event_count;

  // Reply breakdown from events
  const repliedEvents = events.filter((e) => e.event_type === 'replied');
  const positiveReplies = repliedEvents.filter((e) => e.reply_label === 'positive' || e.outcome_classification === 'positive').length;
  const negativeReplies = repliedEvents.filter((e) => e.reply_label === 'negative' || e.outcome_classification === 'negative').length;
  const autoReplies = repliedEvents.filter((e) => e.reply_label === 'auto_reply' || e.outcome_classification === 'auto_reply').length;
  const unclassifiedReplies = repliedCount - positiveReplies - negativeReplies - autoReplies;

  const followupEligible = followup?.summary?.eligible ?? 0;

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: '3px 0',
    fontSize: 12,
  };
  const labelStyle: React.CSSProperties = { color: 'var(--od-text)' };
  const valueStyle: React.CSSProperties = { fontWeight: 600, fontVariantNumeric: 'tabular-nums' };

  return (
    <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
      <h3 className="od-context-block__title">{t.title}</h3>

      {/* Sent / Delivered */}
      <div style={rowStyle}>
        <span style={labelStyle}>{t.sent}</span>
        <span style={valueStyle}>
          {sentCount}
          <span style={{ fontWeight: 400, color: 'var(--od-text-muted)', fontSize: 11 }}> / {s.sendable_draft_count}</span>
        </span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>{t.delivered}</span>
        <span style={{ ...valueStyle, color: deliveredCount > 0 ? 'var(--od-success)' : 'var(--od-text-muted)' }}>
          {deliveredCount}
        </span>
      </div>

      {/* Bounced */}
      <div style={rowStyle}>
        <span style={labelStyle}>{t.bounced}</span>
        <span style={{ ...valueStyle, color: bouncedCount > 0 ? 'var(--od-error)' : 'var(--od-text-muted)' }}>
          {bouncedCount}
          {sentCount > 0 && (
            <span style={{ fontWeight: 400, fontSize: 10, color: bouncedCount > 0 ? 'var(--od-error)' : 'var(--od-text-muted)' }}>
              {' '}{pct(bouncedCount, sentCount)} {t.bounceRate}
            </span>
          )}
        </span>
      </div>

      {/* Replies */}
      <div style={{ ...rowStyle, marginTop: 4 }}>
        <span style={labelStyle}>{t.replies}</span>
        <span style={{ ...valueStyle, color: repliedCount > 0 ? 'var(--od-success)' : 'var(--od-text-muted)' }}>
          {repliedCount}
          {sentCount > 0 && (
            <span style={{ fontWeight: 400, fontSize: 10, color: 'var(--od-text-muted)' }}>
              {' '}{pct(repliedCount, sentCount)} {t.replyRate}
            </span>
          )}
        </span>
      </div>
      {repliedCount > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '2px 0 4px' }}>
          {positiveReplies > 0 && (
            <span className="od-count-chip" style={{ fontSize: 9, color: 'var(--od-success)' }}>
              {positiveReplies} {t.positive}
            </span>
          )}
          {negativeReplies > 0 && (
            <span className="od-count-chip" style={{ fontSize: 9, color: 'var(--od-error)' }}>
              {negativeReplies} {t.negative}
            </span>
          )}
          {autoReplies > 0 && (
            <span className="od-count-chip" style={{ fontSize: 9, color: 'var(--od-text-muted)' }}>
              {autoReplies} {t.autoReply}
            </span>
          )}
          {unclassifiedReplies > 0 && (
            <span className="od-count-chip" style={{ fontSize: 9, color: 'var(--od-warning)' }}>
              {unclassifiedReplies} {t.unclassified}
            </span>
          )}
        </div>
      )}

      {/* Unsubscribed */}
      {unsubCount > 0 && (
        <div style={rowStyle}>
          <span style={labelStyle}>{t.unsubscribed}</span>
          <span style={{ ...valueStyle, color: 'var(--od-warning)' }}>{unsubCount}</span>
        </div>
      )}

      {/* Follow-up */}
      <div style={{ ...rowStyle, marginTop: 4 }}>
        <span style={labelStyle}>{t.followUp}</span>
        <span style={{ ...valueStyle, color: followupEligible > 0 ? 'var(--od-success)' : 'var(--od-text-muted)' }}>
          {followupEligible}
        </span>
      </div>

      {/* Coverage */}
      <div style={{ ...rowStyle, marginTop: 4 }}>
        <span style={labelStyle}>{t.coverage}</span>
        <span style={valueStyle}>
          {s.contacts_with_any_draft} {t.contactsWithDraft}
          <span style={{ fontWeight: 400, color: 'var(--od-text-muted)', fontSize: 10 }}>
            {' / '}{s.snapshot_contacts_without_draft_count} {t.contactsWithoutDraft}
          </span>
        </span>
      </div>
    </div>
  );
}

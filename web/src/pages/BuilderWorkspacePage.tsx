import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchCampaignFollowupCandidates,
  fetchCampaigns,
  fetchCampaignStatusTransitions,
  fetchIcpHypotheses,
  fetchIcpProfiles,
  fetchMailboxes,
  fetchOffers,
  fetchSegments,
  updateCampaignStatus,
  type Campaign,
  type CampaignFollowupCandidate,
  type CampaignFollowupCandidatesView,
  type CampaignLaunchResult,
  type CampaignStatusTransitionsView,
  type MailboxRow,
  type OfferRecord,
} from '../apiClient';
import { BuilderDraftReview } from '../components/BuilderDraftReview';
import { CampaignAutoSendCard } from '../components/CampaignAutoSendCard';
import { CampaignLaunchDrawer } from '../components/CampaignLaunchDrawer';
import { CampaignNextWaveDrawer } from '../components/CampaignNextWaveDrawer';
import { CampaignRotationPreviewDrawer } from '../components/CampaignRotationPreviewDrawer';
import { CampaignSendPolicyCard } from '../components/CampaignSendPolicyCard';
import { CampaignSendPreflightCard } from '../components/CampaignSendPreflightCard';
import { getWorkspaceColors } from '../theme';
import { usePersistedState } from '../hooks/usePersistedState';
import './CampaignOperatorDesk.css';

// ============================================================
// i18n
// ============================================================

const translations: Record<string, Record<string, string>> = {
  en: {
    title: 'Campaign Builder V2',
    campaigns: 'Campaigns',
    search: 'Search campaigns...',
    all: 'All',
    statusTransitions: 'Status transitions',
    moveTo: 'Move to',
    confirm: 'Confirm',
    cancel: 'Cancel',
    updating: 'Updating...',
    noTransitions: 'No transitions available',
    hintDraft: 'Next: draft \u2192 ready \u2192 generating',
    hintReady: 'Next: ready \u2192 generating \u2192 sending',
    hintGenerating: 'Next: generating \u2192 review or sending',
    hintReview: 'Next: review \u2192 generating \u2192 sending',
    hintSending: 'Next: sending \u2192 complete or pause',
    hintPaused: 'Next: paused \u2192 sending or complete',
    hintComplete: 'Terminal status \u2014 campaign is finished',
    followupGuardrail: 'Follow-up guardrail',
    eligible: 'eligible',
    blocked: 'blocked',
    blockReason: 'Block reason',
    count: 'Count',
    replyReceived: 'Reply received',
    bounce: 'Bounce',
    unsubscribed: 'Unsubscribed',
    bumpSent: 'Bump already sent',
    noBlocked: 'No blocked candidates',
    campaign: 'Campaign',
    name: 'Name',
    status: 'Status',
    snapshot: 'Snapshot',
    segment: 'Segment',
    context: 'Context',
    icpProfile: 'ICP Profile',
    offeringDomain: 'Offering domain',
    description: 'Description',
    companyCriteria: 'Company criteria',
    personaCriteria: 'Persona criteria',
    hypothesis: 'Hypothesis',
    label: 'Label',
    searchConfig: 'Search config',
    selectCampaign: 'Select a campaign to begin',
    selectCampaignDrafts: 'Select a campaign to review drafts',
    noCampaigns: 'No campaigns found. Create a campaign via CLI or the Pipeline workspace to get started.',
    noMatch: 'No campaigns match this filter.',
    na: 'n/a',
  },
  ru: {
    title: 'Конструктор кампаний V2',
    campaigns: 'Кампании',
    search: 'Поиск кампаний...',
    all: 'Все',
    statusTransitions: 'Переходы статуса',
    moveTo: 'Перевести в',
    confirm: 'Подтвердить',
    cancel: 'Отмена',
    updating: 'Обновление...',
    noTransitions: 'Нет доступных переходов',
    hintDraft: 'Далее: draft \u2192 ready \u2192 generating',
    hintReady: 'Далее: ready \u2192 generating \u2192 sending',
    hintGenerating: 'Далее: generating \u2192 review или sending',
    hintReview: 'Далее: review \u2192 generating \u2192 sending',
    hintSending: 'Далее: sending \u2192 complete или pause',
    hintPaused: 'Далее: paused \u2192 sending или complete',
    hintComplete: 'Финальный статус \u2014 кампания завершена',
    followupGuardrail: 'Контроль повторных',
    eligible: 'доступно',
    blocked: 'заблокировано',
    blockReason: 'Причина блокировки',
    count: 'Кол-во',
    replyReceived: 'Получен ответ',
    bounce: 'Баунс',
    unsubscribed: 'Отписка',
    bumpSent: 'Бамп уже отправлен',
    noBlocked: 'Нет заблокированных',
    campaign: 'Кампания',
    name: 'Название',
    status: 'Статус',
    snapshot: 'Снимок',
    segment: 'Сегмент',
    context: 'Контекст',
    icpProfile: 'ICP профиль',
    offeringDomain: 'Домен предложения',
    description: 'Описание',
    companyCriteria: 'Критерии компании',
    personaCriteria: 'Критерии персоны',
    hypothesis: 'Гипотеза',
    label: 'Метка',
    searchConfig: 'Конфиг поиска',
    selectCampaign: 'Выберите кампанию',
    selectCampaignDrafts: 'Выберите кампанию для ревью',
    noCampaigns: 'Кампании не найдены. Создайте через CLI или Pipeline.',
    noMatch: 'Нет кампаний для этого фильтра.',
    na: 'н/д',
  },
};

function getT(language: string): Record<string, string> {
  return translations[language] ?? translations['en'];
}

// ============================================================
// Helpers
// ============================================================

function odCssVars(isDark: boolean): React.CSSProperties {
  const c = getWorkspaceColors(isDark);
  return {
    '--od-bg': c.bg,
    '--od-card': c.card,
    '--od-card-hover': c.cardHover,
    '--od-text': c.text,
    '--od-text-muted': c.textMuted,
    '--od-border': c.border,
    '--od-orange': c.orange,
    '--od-orange-light': c.orangeLight,
    '--od-sidebar': c.sidebar,
    '--od-success': c.success,
    '--od-warning': c.warning,
    '--od-error': c.error,
  } as React.CSSProperties;
}

const STATUS_BADGE_TITLES: Record<string, string> = {
  draft: 'Being set up',
  ready: 'Ready for generation',
  generating: 'Drafts being generated',
  review: 'Under review',
  sending: 'Emails being sent',
  paused: 'Sending paused',
  complete: 'Campaign finished',
};

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="od-status-badge od-status-badge--draft">n/a</span>;
  return <span className={`od-status-badge od-status-badge--${status}`} title={STATUS_BADGE_TITLES[status]}>{status}</span>;
}

const CAMPAIGN_STATUS_FILTERS = ['all', 'draft', 'ready', 'generating', 'review', 'sending', 'complete'] as const;
type CampaignStatusFilter = (typeof CAMPAIGN_STATUS_FILTERS)[number];

interface IcpProfileFull {
  name: string | null;
  description: string | null;
  offering_domain: string | null;
  company_criteria: Record<string, unknown> | null;
  persona_criteria: Record<string, unknown> | null;
}

interface HypothesisFull {
  hypothesis_label: string | null;
  status: string | null;
  search_config: Record<string, unknown> | null;
}

interface CampaignContext {
  segmentName: string | null;
  icpProfile: IcpProfileFull | null;
  hypothesis: HypothesisFull | null;
}

interface SegmentRef {
  id: string;
  name?: string | null;
  icp_profile_id?: string | null;
  icp_hypothesis_id?: string | null;
}

interface IcpProfileRef {
  id: string;
  name?: string | null;
  description?: string | null;
  offering_domain?: string | null;
  company_criteria?: Record<string, unknown> | null;
  persona_criteria?: Record<string, unknown> | null;
}

interface HypothesisRef {
  id: string;
  name?: string | null;
  hypothesis_label?: string | null;
  status?: string | null;
  search_config?: Record<string, unknown> | null;
}

function FollowupBreakdown({ candidates, t }: { candidates: CampaignFollowupCandidate[]; t: Record<string, string> }) {
  const blocked = candidates.filter((c) => !c.eligible);
  const reasons = {
    replyReceived: blocked.filter((c) => c.reply_received).length,
    bounce: blocked.filter((c) => c.bounce).length,
    unsubscribed: blocked.filter((c) => c.unsubscribed).length,
    bumpSent: blocked.filter((c) => c.bump_sent).length,
  };
  const hasBlocked = blocked.length > 0;

  return (
    <table style={{ width: '100%', marginTop: 8, fontSize: 12, borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', padding: '4px 0', borderBottom: '1px solid var(--od-border)' }}>{t.blockReason}</th>
          <th style={{ textAlign: 'right', padding: '4px 0', borderBottom: '1px solid var(--od-border)' }}>{t.count}</th>
        </tr>
      </thead>
      <tbody>
        {hasBlocked ? (
          <>
            {reasons.replyReceived > 0 && (
              <tr><td style={{ padding: '3px 0' }}>{t.replyReceived}</td><td style={{ textAlign: 'right', padding: '3px 0' }}>{reasons.replyReceived}</td></tr>
            )}
            {reasons.bounce > 0 && (
              <tr><td style={{ padding: '3px 0' }}>{t.bounce}</td><td style={{ textAlign: 'right', padding: '3px 0' }}>{reasons.bounce}</td></tr>
            )}
            {reasons.unsubscribed > 0 && (
              <tr><td style={{ padding: '3px 0' }}>{t.unsubscribed}</td><td style={{ textAlign: 'right', padding: '3px 0' }}>{reasons.unsubscribed}</td></tr>
            )}
            {reasons.bumpSent > 0 && (
              <tr><td style={{ padding: '3px 0' }}>{t.bumpSent}</td><td style={{ textAlign: 'right', padding: '3px 0' }}>{reasons.bumpSent}</td></tr>
            )}
          </>
        ) : (
          <tr><td colSpan={2} style={{ padding: '3px 0', color: 'var(--od-text-muted)' }}>{t.noBlocked}</td></tr>
        )}
      </tbody>
    </table>
  );
}

const STATUS_HINTS: Record<string, string> = {
  draft: 'hintDraft',
  ready: 'hintReady',
  generating: 'hintGenerating',
  review: 'hintReview',
  sending: 'hintSending',
  paused: 'hintPaused',
  complete: 'hintComplete',
};

function StatusFlowHint({ status, t }: { status: string | undefined; t: Record<string, string> }) {
  const key = STATUS_HINTS[status ?? ''];
  if (!key || !t[key]) return null;
  return (
    <div style={{
      marginTop: 8,
      padding: '6px 10px',
      borderRadius: 6,
      fontSize: 11,
      lineHeight: 1.5,
      color: 'var(--od-text-muted)',
      background: 'color-mix(in srgb, var(--od-border) 40%, transparent)',
    }}>
      {t[key]}
    </div>
  );
}

function JsonKvBlock({ data, label }: { data: Record<string, unknown>; label: string }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  return (
    <div style={{ padding: '4px 0' }}>
      <span className="od-context-row__label" style={{ display: 'block', marginBottom: 4 }}>{label}</span>
      <div style={{ fontSize: 12, color: 'var(--od-text)', lineHeight: 1.5 }}>
        {entries.map(([key, val]) => (
          <div key={key} className="od-context-row" style={{ padding: '1px 0' }}>
            <span className="od-context-row__label">{key}</span>
            <span className="od-context-row__value" style={{ maxWidth: 'none' }}>
              {typeof val === 'string' ? val : JSON.stringify(val)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Main component
// ============================================================

export function BuilderWorkspacePage({
  isDark = false,
  language = 'en',
}: {
  isDark?: boolean;
  language?: string;
}) {
  const t = getT(language);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = usePersistedState('c5:builder-v2:campaign', '');
  const [transitions, setTransitions] = useState<CampaignStatusTransitionsView | null>(null);
  const [followupCandidates, setFollowupCandidates] = useState<CampaignFollowupCandidatesView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyStatus, setBusyStatus] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = usePersistedState('c5:builder-v2:search', '');
  const [statusFilter, setStatusFilter] = usePersistedState<CampaignStatusFilter>('c5:builder-v2:status-filter', 'all');

  // ---- Campaign context (ICP, hypothesis, segment) ----
  const [campaignContext, setCampaignContext] = useState<CampaignContext>({
    segmentName: null,
    icpProfile: null,
    hypothesis: null,
  });

  // ---- Reference data ----
  const [segments, setSegments] = useState<SegmentRef[]>([]);
  const [icpProfiles, setIcpProfiles] = useState<IcpProfileRef[]>([]);
  const [hypotheses, setHypotheses] = useState<HypothesisRef[]>([]);
  const [mailboxes, setMailboxes] = useState<MailboxRow[]>([]);
  const [offers, setOffers] = useState<OfferRecord[]>([]);

  // ---- Launch drawer ----
  const [launchOpen, setLaunchOpen] = useState(false);
  const [nextWaveOpen, setNextWaveOpen] = useState(false);
  const [rotationOpen, setRotationOpen] = useState(false);

  // ---- Resizable columns ----
  const [colWidths, setColWidths] = usePersistedState('c5:builder-v2:col-widths', [260, 320]);
  const dragRef = useRef<{ colIndex: number; startX: number; startWidths: number[] } | null>(null);
  const refreshRequestRef = useRef(0);

  const handleResizeStart = useCallback(
    (colIndex: number, e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { colIndex, startX: e.clientX, startWidths: [...colWidths] };

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = ev.clientX - dragRef.current.startX;
        const MIN_W = 180;
        const next = [...dragRef.current.startWidths];
        next[colIndex] = Math.max(MIN_W, dragRef.current.startWidths[colIndex] + delta);
        setColWidths(next);
      };

      const onMouseUp = () => {
        dragRef.current = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [colWidths]
  );

  // ---- Load campaigns + reference data ----
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetchCampaigns(),
      fetchSegments().catch(() => [] as SegmentRef[]),
      fetchIcpProfiles().then((rows) => rows as IcpProfileRef[]).catch(() => [] as IcpProfileRef[]),
      fetchIcpHypotheses().then((rows) => rows as HypothesisRef[]).catch(() => [] as HypothesisRef[]),
      fetchMailboxes().catch(() => [] as MailboxRow[]),
      fetchOffers({ status: 'active' }).catch(() => [] as OfferRecord[]),
    ])
      .then(([campaignRows, segmentRows, profileRows, hypothesisRows, mailboxRows, offerRows]) => {
        if (cancelled) return;
        setCampaigns(campaignRows);
        setSegments(segmentRows);
        setIcpProfiles(profileRows);
        setHypotheses(hypothesisRows);
        setMailboxes(mailboxRows);
        setOffers(offerRows);
        setSelectedCampaignId((current) => {
          if (current && campaignRows.some((c) => c.id === current)) return current;
          return campaignRows[0]?.id || '';
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? 'Failed to load campaigns');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // ---- Resolve campaign context when selection changes ----
  useEffect(() => {
    if (!selectedCampaignId) {
      setCampaignContext({ segmentName: null, icpProfile: null, hypothesis: null });
      return;
    }
    const campaign = campaigns.find((c) => c.id === selectedCampaignId);
    if (!campaign?.segment_id) {
      setCampaignContext({ segmentName: null, icpProfile: null, hypothesis: null });
      return;
    }
    const seg = segments.find((segment) => segment.id === campaign.segment_id);
    const profile = seg?.icp_profile_id
      ? icpProfiles.find((entry) => entry.id === seg.icp_profile_id)
      : null;
    const hyp = seg?.icp_hypothesis_id
      ? hypotheses.find((entry) => entry.id === seg.icp_hypothesis_id)
      : null;

    setCampaignContext({
      segmentName: seg?.name ?? null,
      icpProfile: profile
        ? {
            name: profile.name ?? null,
            description: profile.description ?? null,
            offering_domain: profile.offering_domain ?? null,
            company_criteria: profile.company_criteria ?? null,
            persona_criteria: profile.persona_criteria ?? null,
          }
        : null,
      hypothesis: hyp
        ? {
            hypothesis_label: hyp.hypothesis_label ?? hyp.name ?? null,
            status: hyp.status ?? null,
            search_config: hyp.search_config ?? null,
          }
        : null,
    });
  }, [selectedCampaignId, campaigns, segments, icpProfiles, hypotheses]);

  const refreshCampaignData = useCallback((campaignId: string) => {
    if (!campaignId) return;
    const requestId = ++refreshRequestRef.current;
    fetchCampaignStatusTransitions(campaignId)
      .then((view) => {
        if (refreshRequestRef.current !== requestId || view.campaignId !== campaignId) return;
        setTransitions(view);
      })
      .catch((err) => setError(err?.message ?? 'Failed to load campaign transitions'));
    fetchCampaignFollowupCandidates(campaignId)
      .then((view) => {
        if (refreshRequestRef.current !== requestId) return;
        setFollowupCandidates(view);
      })
      .catch((err) => setError(err?.message ?? 'Failed to load follow-up candidates'));
  }, []);

  useEffect(() => {
    if (!selectedCampaignId) {
      refreshRequestRef.current += 1;
      setTransitions(null);
      setFollowupCandidates(null);
      return;
    }
    refreshCampaignData(selectedCampaignId);
  }, [selectedCampaignId, refreshCampaignData]);

  const handleStatusChange = async (status: string) => {
    if (!selectedCampaignId) return;
    setBusyStatus(status);
    setError(null);
    setConfirmStatus(null);
    try {
      const updated = await updateCampaignStatus(selectedCampaignId, status);
      const newStatus = updated.status ?? status;
      setCampaigns((prev) =>
        prev.map((c) => (c.id === selectedCampaignId ? { ...c, status: newStatus } : c))
      );
      // Optimistically update transitions so hint/badge reflect new status immediately
      setTransitions((prev) => prev
        ? { ...prev, currentStatus: newStatus, allowedTransitions: [] }
        : prev
      );
      refreshCampaignData(selectedCampaignId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update campaign status');
    } finally {
      setBusyStatus(null);
    }
  };

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);

  const handleLaunched = useCallback((result: CampaignLaunchResult) => {
    const created = result.campaign;
    if (created?.id && created?.name) {
      setCampaigns((prev) => [
        { id: created.id, name: created.name, status: created.status ?? 'draft', segment_id: created.segment_id, segment_version: created.segment_version },
        ...prev,
      ]);
      setSelectedCampaignId(created.id);
    }
  }, []);

  const filteredCampaigns = useMemo(() => {
    let result = campaigns;
    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q));
    }
    return result;
  }, [campaigns, statusFilter, search]);

  const gridTemplate = `${colWidths[0]}px 4px ${colWidths[1]}px 4px 1fr`;

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="operator-desk" style={odCssVars(isDark)}>
        <div style={{ padding: 16 }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>{t.title}</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="od-skeleton" style={{ height: 18, width: '55%' }} />
            <span className="od-skeleton" style={{ height: 14, width: '35%' }} />
            <span className="od-skeleton" style={{ height: 14, width: '70%' }} />
          </div>
        </div>
      </div>
    );
  }

  // ---- Empty state ----
  if (campaigns.length === 0) {
    return (
      <div className="operator-desk" style={odCssVars(isDark)}>
        <div style={{ padding: 16 }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>{t.title}</h1>
          <div className="od-empty">
            <div className="od-empty__line" />
            <span className="od-empty__text">{t.noCampaigns}</span>
          </div>
        </div>
      </div>
    );
  }

  // ---- Main layout ----
  return (
    <div className="operator-desk" style={odCssVars(isDark)}>
      <div style={{ padding: '10px 16px 8px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, flex: 1 }}>{t.title}</h1>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {selectedCampaignId && (
            <button
              type="button"
              className="od-btn"
              style={{ fontSize: 11, padding: '4px 12px', background: 'color-mix(in srgb, var(--od-orange) 12%, transparent)', color: 'var(--od-orange)', border: '1px solid var(--od-orange)' }}
              onClick={() => setRotationOpen(true)}
            >
              {language === 'ru' ? 'Ротация' : 'Rotation'}
            </button>
          )}
          {selectedCampaignId && (
            <button
              type="button"
              className="od-btn"
              style={{ fontSize: 11, padding: '4px 12px', background: 'color-mix(in srgb, var(--od-warning) 12%, transparent)', color: 'var(--od-warning)', border: '1px solid var(--od-warning)' }}
              onClick={() => setNextWaveOpen(true)}
            >
              {language === 'ru' ? 'Волна' : 'Wave'}
            </button>
          )}
          <button
            type="button"
            className="od-btn"
            style={{ fontSize: 11, padding: '4px 14px', background: 'color-mix(in srgb, var(--od-success) 12%, transparent)', color: 'var(--od-success)', border: '1px solid var(--od-success)' }}
            onClick={() => setLaunchOpen(true)}
          >
            {language === 'ru' ? 'Запуск' : 'Launch'}
          </button>
        </div>
      </div>

      {error && <div className="od-error-banner" role="alert">{error}</div>}

      <div
        className="operator-desk__grid"
        style={{ gridTemplateColumns: gridTemplate, flex: 1 }}
      >
        {/* Column 1: Campaign list */}
        <div className="operator-desk__column">
          <div className="od-col-header">
            <h2 className="od-col-title">{t.campaigns}</h2>
            <span className="od-count-chip">{filteredCampaigns.length}</span>
          </div>
          <div className="od-search">
            <input
              className="od-search__input"
              placeholder={t.search}
              title="Search campaigns by name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="od-filterbar">
            {CAMPAIGN_STATUS_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={`od-filter-chip${statusFilter === f ? ' od-filter-chip--active' : ''}`}
                onClick={() => setStatusFilter(f)}
                title={f === 'all' ? 'Show all campaigns' : `Show only ${f} campaigns`}
              >
                {f === 'all' ? t.all : f}
              </button>
            ))}
          </div>
          <div className="od-col-body">
            {filteredCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className={`od-campaign-item${campaign.id === selectedCampaignId ? ' od-campaign-item--pinned' : ''}`}
                onClick={() => setSelectedCampaignId(campaign.id)}
              >
                <span className="od-campaign-item__name">{campaign.name}</span>
                <div className="od-campaign-item__meta">
                  <StatusBadge status={campaign.status} />
                </div>
              </div>
            ))}
            {filteredCampaigns.length === 0 && (
              <div className="od-empty" style={{ minHeight: 80 }}>
                <span className="od-empty__text">{t.noMatch}</span>
              </div>
            )}
          </div>
        </div>

        {/* Drag handle 1→2 */}
        <div className="od-resize-handle" onMouseDown={(e) => handleResizeStart(0, e)} />

        {/* Column 2: Transitions → Followup → Context */}
        <div className="operator-desk__column" style={{ background: 'var(--od-bg)' }}>
          {selectedCampaign ? (
            <div className="od-col-body">
              {/* ---- Status + transitions (top) ---- */}
              <div className="od-context-block">
                <div className="od-context-row">
                  <span className="od-context-row__label">{t.status}</span>
                  <span className="od-context-row__value">
                    <StatusBadge status={transitions?.currentStatus ?? selectedCampaign.status} />
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {(transitions?.allowedTransitions ?? []).map((status) => (
                    <button
                      key={status}
                      type="button"
                      className="od-btn od-btn--ghost"
                      disabled={busyStatus !== null}
                      onClick={() => setConfirmStatus(status)}
                      title={`Transition campaign to ${status} status`}
                    >
                      {t.moveTo} {status}
                    </button>
                  ))}
                  {(transitions?.allowedTransitions ?? []).length === 0 && (
                    <span style={{ fontSize: 12, color: 'var(--od-text-muted)' }}>{t.noTransitions}</span>
                  )}
                </div>
                <StatusFlowHint status={transitions?.currentStatus ?? selectedCampaign.status} t={t} />
                {confirmStatus && (
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--od-text)' }}>
                      {t.moveTo} <strong>{confirmStatus}</strong>?
                    </span>
                    <button
                      type="button"
                      className="od-btn od-btn--approve"
                      disabled={busyStatus !== null}
                      onClick={() => handleStatusChange(confirmStatus)}
                    >
                      {busyStatus ? t.updating : t.confirm}
                    </button>
                    <button
                      type="button"
                      className="od-btn od-btn--ghost"
                      onClick={() => setConfirmStatus(null)}
                    >
                      {t.cancel}
                    </button>
                  </div>
                )}
              </div>

              {/* ---- Follow-up guardrail ---- */}
              <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
                <h3 className="od-context-block__title">{t.followupGuardrail}</h3>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span className="od-count-chip" title="Contacts eligible for follow-up bump email" style={{ background: 'color-mix(in srgb, var(--od-success) 14%, transparent)', color: 'var(--od-success)' }}>
                    {followupCandidates?.summary.eligible ?? 0} {t.eligible}
                  </span>
                  <span className="od-count-chip" title="Contacts blocked from follow-up (reply, bounce, unsubscribe, or bump already sent)" style={{ background: 'color-mix(in srgb, var(--od-warning) 14%, transparent)', color: 'var(--od-warning)' }}>
                    {followupCandidates?.summary.ineligible ?? 0} {t.blocked}
                  </span>
                </div>
                {followupCandidates?.candidates && followupCandidates.candidates.length > 0 && (
                  <FollowupBreakdown candidates={followupCandidates.candidates} t={t} />
                )}
              </div>

              {/* ---- Send preflight ---- */}
              <CampaignSendPreflightCard campaignId={selectedCampaignId} language={language} />

              {/* ---- Auto-send settings ---- */}
              <CampaignAutoSendCard campaignId={selectedCampaignId} language={language} />

              {/* ---- Send policy ---- */}
              <CampaignSendPolicyCard campaignId={selectedCampaignId} language={language} />

              {/* ---- Campaign info ---- */}
              <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
                <h3 className="od-context-block__title">{t.campaign}</h3>
                <div className="od-context-row">
                  <span className="od-context-row__label">{t.name}</span>
                  <span className="od-context-row__value">{selectedCampaign.name}</span>
                </div>
                {selectedCampaign.segment_version != null && (
                  <div className="od-context-row">
                    <span className="od-context-row__label">{t.snapshot}</span>
                    <span className="od-context-row__value">v{selectedCampaign.segment_version}</span>
                  </div>
                )}
                {campaignContext.segmentName && (
                  <div className="od-context-row">
                    <span className="od-context-row__label">{t.segment}</span>
                    <span className="od-context-row__value">{campaignContext.segmentName}</span>
                  </div>
                )}
                {selectedCampaign.offer_id && (() => {
                  const offer = offers.find((o) => o.id === selectedCampaign.offer_id);
                  return offer ? (
                    <div className="od-context-row">
                      <span className="od-context-row__label">{language === 'ru' ? 'Оффер' : 'Offer'}</span>
                      <span className="od-context-row__value">
                        {offer.title}
                        {offer.project_name && <span style={{ color: 'var(--od-text-muted)', fontSize: 11 }}> ({offer.project_name})</span>}
                      </span>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* ---- ICP Profile — full ---- */}
              {campaignContext.icpProfile && (
                <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
                  <h3 className="od-context-block__title">{t.icpProfile}</h3>
                  <div className="od-context-row">
                    <span className="od-context-row__label">{t.name}</span>
                    <span className="od-context-row__value">{campaignContext.icpProfile.name ?? t.na}</span>
                  </div>
                  {campaignContext.icpProfile.offering_domain && (
                    <div style={{ padding: '4px 0' }}>
                      <span className="od-context-row__label" style={{ display: 'block', marginBottom: 2 }}>{t.offeringDomain}</span>
                      <span style={{ fontSize: 12, color: 'var(--od-text)', lineHeight: 1.4, display: 'block' }}>
                        {campaignContext.icpProfile.offering_domain}
                      </span>
                    </div>
                  )}
                  {campaignContext.icpProfile.description && (
                    <div style={{ padding: '4px 0' }}>
                      <span className="od-context-row__label" style={{ display: 'block', marginBottom: 2 }}>{t.description}</span>
                      <span style={{ fontSize: 12, color: 'var(--od-text)', lineHeight: 1.4, display: 'block', whiteSpace: 'pre-wrap' }}>
                        {campaignContext.icpProfile.description}
                      </span>
                    </div>
                  )}
                  {campaignContext.icpProfile.company_criteria && (
                    <JsonKvBlock data={campaignContext.icpProfile.company_criteria} label={t.companyCriteria} />
                  )}
                  {campaignContext.icpProfile.persona_criteria && (
                    <JsonKvBlock data={campaignContext.icpProfile.persona_criteria} label={t.personaCriteria} />
                  )}
                </div>
              )}

              {/* ---- Hypothesis — full ---- */}
              {campaignContext.hypothesis && (
                <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
                  <h3 className="od-context-block__title">{t.hypothesis}</h3>
                  <div className="od-context-row">
                    <span className="od-context-row__label">{t.label}</span>
                    <span className="od-context-row__value">{campaignContext.hypothesis.hypothesis_label ?? t.na}</span>
                  </div>
                  {campaignContext.hypothesis.status && (
                    <div className="od-context-row">
                      <span className="od-context-row__label">{t.status}</span>
                      <span className="od-context-row__value">
                        <StatusBadge status={campaignContext.hypothesis.status} />
                      </span>
                    </div>
                  )}
                  {campaignContext.hypothesis.search_config && (
                    <JsonKvBlock data={campaignContext.hypothesis.search_config} label={t.searchConfig} />
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="od-placeholder">
              <div className="od-placeholder__dash" />
              <span className="od-placeholder__text">{t.selectCampaign}</span>
            </div>
          )}
        </div>

        {/* Drag handle 2→3 */}
        <div className="od-resize-handle" onMouseDown={(e) => handleResizeStart(1, e)} />

        {/* Column 3: Draft Review */}
        <div className="operator-desk__column" style={{ background: 'var(--od-bg)' }}>
          {selectedCampaignId ? (
            <BuilderDraftReview campaignId={selectedCampaignId} />
          ) : (
            <div className="od-placeholder">
              <div className="od-placeholder__dash" />
              <span className="od-placeholder__text">{t.selectCampaignDrafts}</span>
            </div>
          )}
        </div>
      </div>

      {/* Launch drawer */}
      <CampaignLaunchDrawer
        open={launchOpen}
        onClose={() => setLaunchOpen(false)}
        segments={segments}
        mailboxes={mailboxes}
        initialSegmentId={selectedCampaign?.segment_id}
        language={language}
        onLaunched={handleLaunched}
      />

      {/* Next wave drawer */}
      {selectedCampaignId && (
        <CampaignNextWaveDrawer
          open={nextWaveOpen}
          campaignId={selectedCampaignId}
          campaignName={selectedCampaign?.name}
          onClose={() => setNextWaveOpen(false)}
          onCreated={(res) => {
            const created = res.campaign;
            if (created?.id && created?.name) {
              setCampaigns((prev) => [
                { id: created.id, name: created.name, status: created.status ?? 'draft', segment_id: created.segment_id, segment_version: created.segment_version },
                ...prev,
              ]);
              setSelectedCampaignId(created.id);
            }
          }}
          language={language}
        />
      )}

      {/* Rotation preview drawer */}
      {selectedCampaignId && (
        <CampaignRotationPreviewDrawer
          open={rotationOpen}
          campaignId={selectedCampaignId}
          onClose={() => setRotationOpen(false)}
          language={language}
        />
      )}
    </div>
  );
}

export default BuilderWorkspacePage;

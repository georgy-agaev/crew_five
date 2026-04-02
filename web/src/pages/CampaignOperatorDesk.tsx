import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  fetchCampaigns,
  fetchCampaignDetail,
  fetchDrafts,
  fetchCampaignAudit,
  fetchCampaignOutbounds,
  fetchCampaignEvents,
  fetchMailboxes,
  fetchSegments,
  reviewDraftStatus,
  updateDraftContent,
  type Campaign,
  type CampaignDetailCompany,
  type CampaignLaunchResult,
  type OfferRecord,
  type DraftRow,
  type CampaignAuditView,
  type CampaignOutbound,
  type CampaignEvent,
  type MailboxRow,
} from '../apiClient';
import {
  draftReviewReasonOptions,
  getDraftReviewReasonLabel,
  isDraftReviewReasonCode,
  type DraftReviewReasonCode,
} from '../draftReviewReasons';
import { getWorkspaceColors } from '../theme';
import { useDebouncedHover } from '../hooks/useDebouncedHover';
import { CampaignAttachCompaniesDrawer } from '../components/CampaignAttachCompaniesDrawer';
import { CampaignEmployeeDetailsDrawer } from '../components/CampaignEmployeeDetailsDrawer';
import { CampaignNextWaveDrawer } from '../components/CampaignNextWaveDrawer';
import { CampaignRotationPreviewDrawer } from '../components/CampaignRotationPreviewDrawer';
import { CampaignAutoSendCard } from '../components/CampaignAutoSendCard';
import { CampaignBumpQueueCard } from '../components/CampaignBumpQueueCard';
import { CampaignDraftGenerateCard } from '../components/CampaignDraftGenerateCard';
import { CampaignExecutionSummaryCard } from '../components/CampaignExecutionSummaryCard';
import { CampaignLaunchDrawer } from '../components/CampaignLaunchDrawer';
import { CampaignSendPolicyCard } from '../components/CampaignSendPolicyCard';
import { CampaignSendPreflightCard } from '../components/CampaignSendPreflightCard';
import { isRotationPreviewEligibleStatus } from '../rotationEligibility';
import './CampaignOperatorDesk.css';

// ============================================================
// Types
// ============================================================

interface DerivedEmployee {
  contact_id: string;
  full_name: string;
  position: string | null;
  work_email: string | null;
  generic_email: string | null;
  recipient_email: string | null;
  recipient_email_source: 'work' | 'generic' | null;
  sendable: boolean;
  draft_coverage: { intro: boolean; bump: boolean };
  outbound_count: number;
  sent_count: number;
  replied: boolean;
  reply_count: number;
}

type MessageStatusFilter = 'all' | 'generated' | 'approved' | 'rejected' | 'sent';
type MessageSequenceFilter = 'all' | 'intro' | 'bump';

// ============================================================
// Translations
// ============================================================

const translations: Record<string, Record<string, string>> = {
  en: {
    campaigns: 'Campaigns',
    companies: 'Companies',
    employees: 'Employees',
    messages: 'Messages',
    search: 'Search',
    status: 'Status',
    sort: 'Sort',
    all: 'All',
    draft: 'Draft',
    approved: 'Approved',
    rejected: 'Rejected',
    sent: 'Sent',
    generated: 'Generated',
    email1: 'Email 1',
    email2: 'Email 2',
    approve: 'Approve',
    reject: 'Reject',
    rejectReason: 'Reject reason',
    reviewNote: 'Review note',
    saveRejection: 'Save rejection',
    cancel: 'Cancel',
    selectReason: 'Select a reason',
    pickRejectReason: 'Pick a rejection reason before saving.',
    noteRequiredForOther: 'Add a note when using the "Other" reason.',
    reviewMeta: 'Review metadata',
    viewTrace: 'View trace',
    noCompanySelected: 'Select a company',
    noEmployeeSelected: 'Select an employee',
    noCampaignSelected: 'Select a campaign to begin',
    noEmployees: 'No campaign employees for this company',
    noMessage: 'No message for this employee in the selected state',
    traceTitle: 'Message Trace',
    close: 'Close',
    noDraftYet: 'No outbound yet',
    noEventYet: 'No event yet',
    context: 'Context',
    icp: 'ICP',
    offer: 'Offer',
    hypothesis: 'Hypothesis',
    segment: 'Segment',
    snapshotVersion: 'Snapshot',
    fresh: 'fresh',
    stale: 'stale',
    missing: 'missing',
    enriched: 'enriched',
    contacts: 'contacts',
    sendable: 'sendable',
    needsFix: 'needs fix',
    employee: 'Employee',
    workEmail: 'Work email',
    genericEmail: 'Generic email',
    delivery: 'Delivery',
    replies: 'Replies',
    subject: 'Subject',
    body: 'Body',
    pattern: 'Pattern',
    recipient: 'Recipient',
    sentLocked: 'Sent drafts are locked',
    loading: 'Loading...',
    rotationRequiresSentWave: 'Rotation preview is available only for sending, paused, or completed campaigns',
    research: 'Research',
    name: 'Name',
    updated: 'Updated',
    na: 'n/a',
    region: 'Region',
    headcount: 'Headcount',
    officeType: 'Office',
    description: 'Description',
    provider: 'Provider',
    lastEnriched: 'Last enriched',
    edit: 'Edit',
    save: 'Save',
    saving: 'Saving...',
  },
  ru: {
    campaigns: 'Кампании',
    companies: 'Компании',
    employees: 'Сотрудники',
    messages: 'Сообщения',
    search: 'Поиск',
    status: 'Статус',
    sort: 'Сортировка',
    all: 'Все',
    draft: 'Черновик',
    approved: 'Одобрено',
    rejected: 'Отклонено',
    sent: 'Отправлено',
    generated: 'Генерировано',
    email1: 'Письмо 1',
    email2: 'Письмо 2',
    approve: 'Одобрить',
    reject: 'Отклонить',
    rejectReason: 'Причина отклонения',
    reviewNote: 'Комментарий',
    saveRejection: 'Сохранить отклонение',
    cancel: 'Отмена',
    selectReason: 'Выберите причину',
    pickRejectReason: 'Сначала выберите причину отклонения.',
    noteRequiredForOther: 'Для причины "Другое" нужен текстовый комментарий.',
    reviewMeta: 'Мета ревью',
    viewTrace: 'Трейс',
    noCompanySelected: 'Выберите компанию',
    noEmployeeSelected: 'Выберите сотрудника',
    noCampaignSelected: 'Выберите кампанию',
    noEmployees: 'Нет сотрудников для этой компании',
    noMessage: 'Нет сообщения для выбранного состояния',
    traceTitle: 'Трейс сообщения',
    close: 'Закрыть',
    noDraftYet: 'Нет отправки',
    noEventYet: 'Нет событий',
    context: 'Контекст',
    icp: 'ICP',
    offer: 'Оффер',
    hypothesis: 'Гипотеза',
    segment: 'Сегмент',
    snapshotVersion: 'Снимок',
    fresh: 'свежий',
    stale: 'устарел',
    missing: 'отсутствует',
    enriched: 'обогащен',
    contacts: 'контакты',
    sendable: 'готов',
    needsFix: 'нужен email',
    employee: 'Сотрудник',
    workEmail: 'Рабочий email',
    genericEmail: 'Общий email',
    delivery: 'Отправки',
    replies: 'Ответы',
    subject: 'Тема',
    body: 'Текст',
    pattern: 'Паттерн',
    recipient: 'Получатель',
    sentLocked: 'Отправленные черновики заблокированы',
    loading: 'Загрузка...',
    rotationRequiresSentWave: 'Ротация доступна только для кампаний в статусе sending, paused или complete',
    research: 'Исследование',
    name: 'Имя',
    updated: 'Обновлено',
    na: 'н/д',
    region: 'Регион',
    headcount: 'Штат',
    officeType: 'Офис',
    description: 'Описание',
    provider: 'Провайдер',
    lastEnriched: 'Обогащено',
    edit: 'Редактировать',
    save: 'Сохранить',
    saving: 'Сохранение...',
  },
};

function getT(language: string): Record<string, string> {
  return translations[language] ?? translations['en'];
}

// ============================================================
// Helpers
// ============================================================

const LIFECYCLE_PRIORITY: Record<string, number> = {
  sent: 0,
  approved: 1,
  generated: 2,
  rejected: 3,
};

function lifecyclePriority(status: string | undefined): number {
  return LIFECYCLE_PRIORITY[status ?? ''] ?? 99;
}

function sortDrafts(drafts: DraftRow[]): DraftRow[] {
  return [...drafts].sort((a, b) => {
    const ua = a.updated_at ?? '';
    const ub = b.updated_at ?? '';
    if (ub !== ua) return ub.localeCompare(ua);
    const ca = a.created_at ?? '';
    const cb = b.created_at ?? '';
    if (cb !== ca) return cb.localeCompare(ca);
    return lifecyclePriority(a.status) - lifecyclePriority(b.status);
  });
}

export function deriveEmployeesFromCampaignCompany(
  company: CampaignDetailCompany | null
): DerivedEmployee[] {
  if (!company) return [];
  return company.employees.map((employee) => ({
    contact_id: employee.contact_id,
    full_name: employee.full_name ?? 'Unknown',
    position: employee.position ?? null,
    work_email: employee.work_email ?? null,
    generic_email: employee.generic_email ?? null,
    recipient_email: employee.work_email ?? employee.generic_email ?? null,
    recipient_email_source: employee.work_email ? 'work' : employee.generic_email ? 'generic' : null,
    sendable: Boolean(employee.work_email ?? employee.generic_email),
    draft_coverage: {
      intro: employee.draft_counts.intro > 0,
      bump: employee.draft_counts.bump > 0,
    },
    outbound_count: employee.outbound_count,
    sent_count: employee.sent_count,
    replied: employee.replied,
    reply_count: employee.reply_count,
  }));
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function truncate(str: string | null | undefined, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

export function mergeUpdatedDraftRow(current: DraftRow, updated: DraftRow): DraftRow {
  return {
    ...current,
    ...updated,
    contact_name: updated.contact_name ?? current.contact_name,
    contact_position: updated.contact_position ?? current.contact_position,
    company_name: updated.company_name ?? current.company_name,
    recipient_email: updated.recipient_email ?? current.recipient_email,
    recipient_email_source: updated.recipient_email_source ?? current.recipient_email_source,
    recipient_email_kind: updated.recipient_email_kind ?? current.recipient_email_kind,
    sendable: updated.sendable ?? current.sendable,
  };
}

export function getDraftReviewActions(status?: string): {
  canApprove: boolean;
  canReject: boolean;
  locked: boolean;
} {
  if (status === 'sent') {
    return { canApprove: false, canReject: false, locked: true };
  }
  if (status === 'approved') {
    return { canApprove: false, canReject: true, locked: false };
  }
  if (status === 'rejected') {
    return { canApprove: true, canReject: false, locked: false };
  }
  return { canApprove: true, canReject: true, locked: false };
}

function getDraftReviewMeta(draft: DraftRow) {
  const metadata = draft.metadata ?? {};
  const primaryCode = isDraftReviewReasonCode(metadata.review_reason_code) ? metadata.review_reason_code : null;
  const reasonCodes = Array.isArray(metadata.review_reason_codes)
    ? metadata.review_reason_codes.filter((value): value is DraftReviewReasonCode => isDraftReviewReasonCode(value))
    : primaryCode
      ? [primaryCode]
      : [];

  return {
    primaryCode,
    primaryLabel: getDraftReviewReasonLabel(primaryCode),
    reasonCodes,
    reasonText: typeof metadata.review_reason_text === 'string' ? metadata.review_reason_text.trim() : '',
    reviewedAt: typeof metadata.reviewed_at === 'string' ? metadata.reviewed_at : null,
    reviewedBy: typeof metadata.reviewed_by === 'string' ? metadata.reviewed_by : null,
  };
}

// ============================================================
// Sub-components
// ============================================================

function SkeletonLine({ width = '100%', height = 12 }: { width?: string | number; height?: number }) {
  return (
    <span
      className="od-skeleton"
      style={{ display: 'block', width, height, borderRadius: 3 }}
    />
  );
}

function EnrichBadge({ status, t }: { status: 'fresh' | 'stale' | 'missing'; t: Record<string, string> }) {
  const cls =
    status === 'fresh'
      ? 'od-enrich-badge--fresh'
      : status === 'stale'
      ? 'od-enrich-badge--stale'
      : 'od-enrich-badge--missing';
  return <span className={`od-enrich-badge ${cls}`}>{t[status] ?? status}</span>;
}

function StatusBadge({ status }: { status: string | undefined }) {
  const s = (status ?? 'draft').toLowerCase();
  return (
    <span className={`od-status-badge od-status-badge--${s}`}>{s}</span>
  );
}

function CoverageDotsDisplay({ coverage }: { coverage: { intro: boolean; bump: boolean } }) {
  return (
    <span className="od-coverage-dots" title="Email 1 / Email 2">
      <span
        className={`od-coverage-dot ${coverage.intro ? 'od-coverage-dot--filled' : ''}`}
        title="intro"
      />
      <span
        className={`od-coverage-dot ${coverage.bump ? 'od-coverage-dot--filled' : ''}`}
        title="bump"
      />
    </span>
  );
}

// ============================================================
// Props
// ============================================================

interface CampaignOperatorDeskProps {
  isDark: boolean;
  language: string;
}

// ============================================================
// Main component
// ============================================================

export default function CampaignOperatorDesk({ isDark, language }: CampaignOperatorDeskProps) {
  const colors = getWorkspaceColors(isDark);
  const t = getT(language);

  // ---- Data state ----
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [auditView, setAuditView] = useState<CampaignAuditView | null>(null);
  const [campaignOffer, setCampaignOffer] = useState<OfferRecord | null>(null);
  const [campaignProject, setCampaignProject] = useState<{ id: string; key: string; name: string } | null>(null);
  const [campaignHypothesis, setCampaignHypothesis] = useState<{ id: string; name: string | null; messaging_angle: string | null } | null>(null);
  const [outbounds, setOutbounds] = useState<CampaignOutbound[]>([]);
  const [events, setEvents] = useState<CampaignEvent[]>([]);

  // ---- Selection (always-pinned: click sets, never unsets) ----
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('campaign') || null;
  });
  const [pinnedCompanyId, setPinnedCompanyId] = useState<string | null>(null);
  const [pinnedEmployeeId, setPinnedEmployeeId] = useState<string | null>(null);

  // ---- Hover (debounced) ----
  const companyHover = useDebouncedHover(150);
  const employeeHover = useDebouncedHover(150);

  // ---- Active IDs ----
  const activeCompanyId = pinnedCompanyId ?? companyHover.hoveredId;
  const activeEmployeeId = pinnedEmployeeId ?? employeeHover.hoveredId;

  // ---- Filters ----
  const [campaignSearch, setCampaignSearch] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [companyResearchFilter, setCompanyResearchFilter] = useState<'all' | 'fresh' | 'stale' | 'missing'>('all');
  const [messageStatusFilter, setMessageStatusFilter] = useState<MessageStatusFilter>('all');
  const [messageSequenceFilter, setMessageSequenceFilter] = useState<MessageSequenceFilter>('all');

  // ---- Companies from API ----
  const [companies, setCompanies] = useState<CampaignDetailCompany[]>([]);

  // ---- Drawer ----
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDraftId, setDrawerDraftId] = useState<string | null>(null);

  // ---- Resizable columns ----
  const [colWidths, setColWidths] = useState([240, 280, 260]);
  const dragRef = useRef<{ colIndex: number; startX: number; startWidths: number[] } | null>(null);

  const handleResizeStart = useCallback(
    (colIndex: number, e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { colIndex, startX: e.clientX, startWidths: [...colWidths] };

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = ev.clientX - dragRef.current.startX;
        const MIN_W = 140;
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

  // ---- Resizable message list height ----
  const [msgListHeight, setMsgListHeight] = useState(200);
  const msgDragRef = useRef<{ startY: number; startH: number } | null>(null);

  const handleMsgResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      msgDragRef.current = { startY: e.clientY, startH: msgListHeight };

      const onMouseMove = (ev: MouseEvent) => {
        if (!msgDragRef.current) return;
        const delta = ev.clientY - msgDragRef.current.startY;
        setMsgListHeight(Math.max(60, Math.min(600, msgDragRef.current.startH + delta)));
      };

      const onMouseUp = () => {
        msgDragRef.current = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [msgListHeight]
  );

  // ---- Loading / error ----
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Launch drawer ----
  const [launchOpen, setLaunchOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [employeeDetailsOpen, setEmployeeDetailsOpen] = useState(false);
  const [nextWaveOpen, setNextWaveOpen] = useState(false);
  const [rotationOpen, setRotationOpen] = useState(false);
  const [launchSegments, setLaunchSegments] = useState<{ id: string; name?: string | null }[]>([]);
  const [launchMailboxes, setLaunchMailboxes] = useState<MailboxRow[]>([]);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (employeeDetailsOpen) { setEmployeeDetailsOpen(false); return; }
        if (drawerOpen) { setDrawerOpen(false); return; }
        if (launchOpen) { setLaunchOpen(false); return; }
        if (nextWaveOpen) { setNextWaveOpen(false); return; }
        if (rotationOpen) { setRotationOpen(false); return; }
        if (attachOpen) { setAttachOpen(false); return; }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [employeeDetailsOpen, drawerOpen, launchOpen, nextWaveOpen, rotationOpen, attachOpen]);

  // ---- Fetch campaigns on mount ----
  useEffect(() => {
    let cancelled = false;
    fetchCampaigns()
      .then((data) => { if (!cancelled) setCampaigns(data); })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); })
      .finally(() => { if (!cancelled) setLoadingCampaigns(false); });
    // Load launch reference data in background
    fetchSegments().then((data) => { if (!cancelled) setLaunchSegments(data); }).catch(() => {});
    fetchMailboxes().then((data) => { if (!cancelled) setLaunchMailboxes(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

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

  // ---- Fetch campaign data when selected ----
  useEffect(() => {
    if (!selectedCampaignId) {
      // Reset derived state via individual callbacks so they run in a single batch
      const clear = () => {
        setCompanies([]);
        setDrafts([]);
        setAuditView(null);
        setOutbounds([]);
        setEvents([]);
        setPinnedCompanyId(null);
        setPinnedEmployeeId(null);
      };
      // Defer the clear so it runs outside the effect body synchronously
      const t = setTimeout(clear, 0);
      return () => clearTimeout(t);
    }

    let cancelled = false;

    // Defer loading flag and selection resets so they don't run synchronously in the effect body
    const resetTimer = setTimeout(() => {
      if (!cancelled) {
        setLoadingCompanies(true);
        setPinnedCompanyId(null);
        setPinnedEmployeeId(null);
      }
    }, 0);

    fetchCampaignDetail(selectedCampaignId)
      .then((v) => { if (!cancelled) { setCompanies(v.companies); setCampaignOffer(v.offer ?? null); setCampaignHypothesis(v.icp_hypothesis ?? null); setCampaignProject(v.project ?? null); } })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); })
      .finally(() => { if (!cancelled) setLoadingCompanies(false); });

    fetchDrafts(selectedCampaignId, undefined, true)
      .then((data) => { if (!cancelled) setDrafts(data); })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); });

    fetchCampaignAudit(selectedCampaignId)
      .then((data) => { if (!cancelled) setAuditView(data); })
      .catch(() => { if (!cancelled) setAuditView(null); });

    fetchCampaignOutbounds(selectedCampaignId)
      .then((v) => { if (!cancelled) setOutbounds(v.outbounds); })
      .catch(() => { if (!cancelled) setOutbounds([]); });

    fetchCampaignEvents(selectedCampaignId)
      .then((v) => { if (!cancelled) setEvents(v.events); })
      .catch(() => { if (!cancelled) setEvents([]); });

    return () => {
      cancelled = true;
      clearTimeout(resetTimer);
    };
  }, [selectedCampaignId]);

  // ---- Reset pinned employee when active company changes (event handler pattern) ----
  // Handled inline in the company click handler instead of a separate effect

  // ---- Derived employees ----
  const employees = useMemo(
    () =>
      deriveEmployeesFromCampaignCompany(
        activeCompanyId
          ? ((companies.find((company) => company.company_id === activeCompanyId) ?? null) as CampaignDetailCompany | null)
          : null
      ),
    [companies, activeCompanyId]
  );

  const activeEmployee = useMemo(
    () => (activeEmployeeId ? employees.find((employee) => employee.contact_id === activeEmployeeId) ?? null : null),
    [employees, activeEmployeeId]
  );

  // ---- Filtered campaigns ----
  const filteredCampaigns = useMemo(() => {
    const q = campaignSearch.toLowerCase();
    return q
      ? campaigns.filter((c) => c.name.toLowerCase().includes(q))
      : campaigns;
  }, [campaigns, campaignSearch]);

  // ---- Filtered companies ----
  const filteredCompanies = useMemo(() => {
    let result = companies;
    if (companySearch) {
      const q = companySearch.toLowerCase();
      result = result.filter(
        (c) =>
          (c.company_name ?? '').toLowerCase().includes(q) ||
          (c.website ?? '').toLowerCase().includes(q)
      );
    }
    if (companyResearchFilter !== 'all') {
      result = result.filter((c) => c.enrichment.status === companyResearchFilter);
    }
    return result;
  }, [companies, companySearch, companyResearchFilter]);

  // ---- Active company object (for context card) ----
  const activeCompany = useMemo(
    () => (activeCompanyId ? companies.find((c) => c.company_id === activeCompanyId) ?? null : null),
    [companies, activeCompanyId]
  );

  // ---- Message resolution for active employee ----
  const activeEmployeeDrafts = useMemo(() => {
    if (!activeEmployeeId) return [];
    return drafts.filter((d) => d.contact_id === activeEmployeeId);
  }, [drafts, activeEmployeeId]);

  const filteredMessages = useMemo((): DraftRow[] => {
    let pool = activeEmployeeDrafts;
    if (messageStatusFilter !== 'all') pool = pool.filter((d) => d.status === messageStatusFilter);
    if (messageSequenceFilter !== 'all') {
      const type = messageSequenceFilter === 'intro' ? 'intro' : 'bump';
      pool = pool.filter((d) => d.email_type === type);
    }
    return sortDrafts(pool);
  }, [activeEmployeeDrafts, messageStatusFilter, messageSequenceFilter]);

  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  // Auto-select first message when list changes
  useEffect(() => {
    if (filteredMessages.length > 0) {
      setSelectedMessageId((prev) => {
        if (prev && filteredMessages.some((m) => m.id === prev)) return prev;
        return filteredMessages[0].id;
      });
    } else {
      setSelectedMessageId(null);
    }
  }, [filteredMessages]);

  const selectedMessage = useMemo(
    () => filteredMessages.find((m) => m.id === selectedMessageId) ?? null,
    [filteredMessages, selectedMessageId]
  );

  // ---- Drawer trace data ----
  const drawerOutbound = useMemo(
    () => (drawerDraftId ? outbounds.find((o) => o.draft_id === drawerDraftId) ?? null : null),
    [outbounds, drawerDraftId]
  );
  const drawerEvents = useMemo(
    () => (drawerOutbound ? events.filter((e) => e.outbound_id === drawerOutbound.id) : []),
    [events, drawerOutbound]
  );

  // ---- Selected campaign object ----
  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId]
  );
  const canOpenRotationPreview = isRotationPreviewEligibleStatus(selectedCampaign?.status);

  // ---- Review handler ----
  const handleReview = useCallback(
    async (
      draftId: string,
      review: {
        status: 'approved' | 'rejected';
        metadata?: Record<string, unknown>;
      }
    ) => {
      try {
        const updated = await reviewDraftStatus(draftId, {
          status: review.status,
          reviewer: 'campaigns-ui',
          metadata: {
            review_surface: 'campaigns',
            reviewed_at: new Date().toISOString(),
            reviewed_by: 'campaigns-ui',
            ...(review.status === 'approved'
              ? {
                  review_reason_code: null,
                  review_reason_codes: [],
                  review_reason_text: null,
                }
              : {}),
            ...(review.metadata ?? {}),
          },
        });
        setDrafts((prev) =>
          prev.map((d) => (d.id === draftId ? mergeUpdatedDraftRow(d, updated) : d))
        );
      } catch (e) {
        setError(String((e as Error)?.message ?? e));
      }
    },
    []
  );

  // ---- Save draft content handler ----
  const handleSaveDraft = useCallback(
    async (draftId: string, subject: string, body: string) => {
      try {
        const updated = await updateDraftContent(draftId, { subject, body });
        setDrafts((prev) =>
          prev.map((d) => (d.id === draftId ? mergeUpdatedDraftRow(d, updated) : d))
        );
      } catch (e) {
        setError(String((e as Error)?.message ?? e));
      }
    },
    []
  );

  // ---- Open drawer ----
  const openDrawer = useCallback((draftId: string) => {
    setDrawerDraftId(draftId);
    setDrawerOpen(true);
  }, []);

  // ---- Grid template from dynamic widths (includes 4px drag handles between columns) ----
  const gridTemplate = `${colWidths[0]}px 4px ${colWidths[1]}px 4px ${colWidths[2]}px 4px 1fr`;

  // ---- CSS variables object ----
  const cssVars = {
    '--od-bg': colors.bg,
    '--od-card': colors.card,
    '--od-card-hover': colors.cardHover,
    '--od-text': colors.text,
    '--od-text-muted': colors.textMuted,
    '--od-border': colors.border,
    '--od-orange': colors.orange,
    '--od-orange-light': colors.orangeLight,
    '--od-sidebar': colors.sidebar,
    '--od-success': colors.success,
    '--od-warning': colors.warning,
    '--od-error': colors.error,
  } as React.CSSProperties;

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="operator-desk" style={cssVars}>
      {error && (
        <div className="od-error-banner">{error}</div>
      )}

      <div className="operator-desk__grid" style={{ gridTemplateColumns: gridTemplate }}>
        {/* ================================================
            Column 1: Campaigns
            ================================================ */}
        <div className="operator-desk__column">
          <div className="od-col-header">
            <span className="od-col-title">{t.campaigns}</span>
            {loadingCampaigns && <SkeletonLine width={40} height={10} />}
            {!loadingCampaigns && (
              <span className="od-count-chip">{filteredCampaigns.length}</span>
            )}
            <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
              {selectedCampaignId && (
                <button
                  type="button"
                  className="od-btn"
                  style={{
                    fontSize: 9,
                    padding: '2px 8px',
                    background: 'color-mix(in srgb, var(--od-orange) 12%, transparent)',
                    color: 'var(--od-orange)',
                    border: '1px solid var(--od-orange)',
                    opacity: canOpenRotationPreview ? 1 : 0.45,
                    cursor: canOpenRotationPreview ? 'pointer' : 'not-allowed',
                  }}
                  onClick={() => canOpenRotationPreview && setRotationOpen(true)}
                  disabled={!canOpenRotationPreview}
                  title={canOpenRotationPreview ? (language === 'ru' ? 'Ротация' : 'Rotation preview') : t.rotationRequiresSentWave}
                >
                  {language === 'ru' ? 'Рот.' : 'Rot.'}
                </button>
              )}
              {selectedCampaignId && (
                <button
                  type="button"
                  className="od-btn"
                  style={{ fontSize: 9, padding: '2px 8px', background: 'color-mix(in srgb, var(--od-warning) 12%, transparent)', color: 'var(--od-warning)', border: '1px solid var(--od-warning)' }}
                  onClick={() => setNextWaveOpen(true)}
                  title={language === 'ru' ? 'Следующая волна' : 'Next wave'}
                >
                  {language === 'ru' ? 'Волна' : 'Wave'}
                </button>
              )}
              <button
                type="button"
                className="od-btn"
                style={{ fontSize: 9, padding: '2px 8px', background: 'color-mix(in srgb, var(--od-success) 12%, transparent)', color: 'var(--od-success)', border: '1px solid var(--od-success)' }}
                onClick={() => setLaunchOpen(true)}
                title={language === 'ru' ? 'Запустить кампанию' : 'Launch campaign'}
              >
                {language === 'ru' ? 'Запуск' : 'Launch'}
              </button>
            </div>
          </div>

          <div className="od-search">
            <input
              className="od-search__input"
              placeholder={t.search}
              value={campaignSearch}
              onChange={(e) => setCampaignSearch(e.target.value)}
            />
          </div>

          {/* Campaign list */}
          <div className="od-col-body">
            {loadingCampaigns && (
              <div style={{ padding: '12px' }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <SkeletonLine width="70%" height={13} />
                    <div style={{ height: 4 }} />
                    <SkeletonLine width="40%" height={10} />
                  </div>
                ))}
              </div>
            )}
            {!loadingCampaigns && filteredCampaigns.length === 0 && (
              <div className="od-empty">
                <span className="od-empty__line" />
                <span className="od-empty__text">{t.noCampaignSelected}</span>
              </div>
            )}
            {!loadingCampaigns &&
              filteredCampaigns.map((campaign) => {
                const isPinned = selectedCampaignId === campaign.id;
                return (
                  <div
                    key={campaign.id}
                    className={`od-campaign-item${isPinned ? ' od-campaign-item--pinned' : ''}`}
                    onClick={() => setSelectedCampaignId(campaign.id)}
                  >
                    <span className="od-campaign-item__name" title={campaign.name}>{campaign.name}</span>
                    <span className="od-campaign-item__meta">
                      <StatusBadge status={campaign.status} />
                    </span>
                  </div>
                );
              })}
          </div>

          {/* Context block (scrollable) */}
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <div className="od-context-block">
            <p className="od-context-block__title">{t.context}</p>
            {!selectedCampaign ? (
              <div className="od-context-row">
                <span className="od-context-row__label od-context-row__value--na">
                  {t.noCampaignSelected}
                </span>
              </div>
            ) : (
              <>
                <ContextRow label={t.status} value={selectedCampaign.status ?? t.na} />
                <ContextRow
                  label={t.segment}
                  value={
                    selectedCampaign.segment_id
                      ? truncate(
                          launchSegments.find((s) => s.id === selectedCampaign.segment_id)?.name
                            ?? selectedCampaign.segment_id,
                          24
                        )
                      : t.na
                  }
                />
                <ContextRow
                  label={t.snapshotVersion}
                  value={
                    selectedCampaign.segment_version != null
                      ? `v${selectedCampaign.segment_version}`
                      : t.na
                  }
                />
                {auditView && (
                  <>
                    <ContextRow
                      label={t.contacts}
                      value={String(auditView.summary.snapshot_contact_count ?? 0)}
                    />
                  </>
                )}
                {campaignProject && (
                  <div className="od-context-row">
                    <span className="od-context-row__label">{language === 'ru' ? 'Проект' : 'Project'}</span>
                    <span className="od-context-row__value">{campaignProject.name} <span style={{ color: 'var(--od-text-muted)', fontSize: 11 }}>({campaignProject.key})</span></span>
                  </div>
                )}
                {campaignOffer && (
                  <div className="od-context-row">
                    <span className="od-context-row__label">{language === 'ru' ? 'Оффер' : 'Offer'}</span>
                    <span className="od-context-row__value">
                      {campaignOffer.title}
                      {campaignOffer.project_name && (
                        <span style={{ color: 'var(--od-text-muted)', fontSize: 11 }}> ({campaignOffer.project_name})</span>
                      )}
                    </span>
                  </div>
                )}
                {campaignHypothesis && (
                  <div className="od-context-row">
                    <span className="od-context-row__label">{language === 'ru' ? 'Гипотеза' : 'Hypothesis'}</span>
                    <span className="od-context-row__value">
                      {campaignHypothesis.name ?? campaignHypothesis.id}
                      {campaignHypothesis.messaging_angle && (
                        <span style={{ color: 'var(--od-text-muted)', fontSize: 11 }}> — {campaignHypothesis.messaging_angle}</span>
                      )}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Execution summary */}
          <CampaignExecutionSummaryCard campaignId={selectedCampaignId ?? undefined} language={language} />

          {/* Send preflight */}
          <CampaignSendPreflightCard campaignId={selectedCampaignId ?? undefined} compact language={language} />
          <CampaignDraftGenerateCard campaignId={selectedCampaignId ?? undefined} language={language} />
          <CampaignBumpQueueCard campaignId={selectedCampaignId ?? undefined} language={language} />
          <CampaignAutoSendCard campaignId={selectedCampaignId ?? undefined} language={language} />
          <CampaignSendPolicyCard campaignId={selectedCampaignId ?? undefined} language={language} />
          </div>
        </div>

        {/* Drag handle 1→2 */}
        <div className="od-resize-handle" onMouseDown={(e) => handleResizeStart(0, e)} />

        {/* ================================================
            Column 2: Companies
            ================================================ */}
        <div className="operator-desk__column">
          <div className="od-col-header">
            <span className="od-col-title">{t.companies}</span>
            {!loadingCompanies && selectedCampaignId && (
              <span className="od-count-chip">{filteredCompanies.length}</span>
            )}
            {selectedCampaignId && (
              <button
                type="button"
                className="od-btn od-btn--ghost"
                style={{ fontSize: 10, padding: '3px 10px', marginLeft: 'auto' }}
                onClick={() => setAttachOpen(true)}
              >
                + {language === 'ru' ? 'Добавить' : 'Attach'}
              </button>
            )}
          </div>

          {!selectedCampaignId ? (
            <div className="od-col-body">
              <div className="od-placeholder">
                <div className="od-placeholder__dash" />
                <span className="od-placeholder__text">{t.noCampaignSelected}</span>
              </div>
            </div>
          ) : (
            <>
              <div className="od-search">
                <input
                  className="od-search__input"
                  placeholder={t.search}
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                />
              </div>

              <div className="od-filterbar">
                {(['all', 'fresh', 'stale', 'missing'] as const).map((f) => (
                  <button
                    key={f}
                    className={`od-filter-chip${companyResearchFilter === f ? ' od-filter-chip--active' : ''}`}
                    onClick={() => setCompanyResearchFilter(f)}
                  >
                    {f === 'all' ? t.all : t[f] ?? f}
                  </button>
                ))}
              </div>

              <div className="od-col-body">
                {loadingCompanies && (
                  <div style={{ padding: '12px' }}>
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} style={{ marginBottom: 12 }}>
                        <SkeletonLine width="65%" height={13} />
                        <div style={{ height: 4 }} />
                        <SkeletonLine width="50%" height={10} />
                        <div style={{ height: 4 }} />
                        <SkeletonLine width="35%" height={10} />
                      </div>
                    ))}
                  </div>
                )}
                {!loadingCompanies && filteredCompanies.length === 0 && (
                  <div className="od-empty">
                    <span className="od-empty__line" />
                    <span className="od-empty__text">{t.noCompanySelected}</span>
                  </div>
                )}
                {!loadingCompanies &&
                  filteredCompanies.map((company) => {
                    const isHovered = companyHover.hoveredId === company.company_id;
                    const isPinned = pinnedCompanyId === company.company_id;
                    return (
                      <div
                        key={company.company_id}
                        className={`od-company-item${isHovered ? ' od-company-item--hovered' : ''}${isPinned ? ' od-company-item--pinned' : ''}`}
                        onMouseEnter={() => companyHover.onMouseEnter(company.company_id)}
                        onMouseLeave={companyHover.onMouseLeave}
                        onClick={() => {
                          setPinnedCompanyId(company.company_id);
                          setPinnedEmployeeId(null);
                        }}
                      >
                        <span className="od-company-item__name" title={company.company_name ?? company.company_id}>
                          {company.company_name ?? company.company_id}
                        </span>
                        {company.website && (
                          <a
                            className="od-company-item__website"
                            href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={company.website}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {truncate(company.website, 32)}
                          </a>
                        )}
                        <div className="od-company-item__foot">
                          <EnrichBadge status={company.enrichment.status} t={t} />
                          <span className="od-count-chip" title={t.contacts}>
                            {company.contact_count}
                          </span>
                          {company.employee_count != null && (
                            <span className="od-count-chip" title={t.employees}>
                              {company.employee_count}
                            </span>
                          )}
                          {company.region && (
                            <span className="od-region-chip" title={company.region}>
                              {truncate(company.region, 12)}
                            </span>
                          )}
                        </div>
                        {company.composition_summary && (
                          <div className="od-company-item__foot" style={{ marginTop: 2 }}>
                            <span className="od-count-chip" title={language === 'ru' ? 'Готово к intro' : 'Eligible for intro'}
                              style={{ color: company.composition_summary.eligible_for_new_intro_contacts > 0 ? 'var(--od-success)' : 'var(--od-text-muted)', fontSize: 10 }}
                            >
                              {company.composition_summary.eligible_for_new_intro_contacts}/{company.composition_summary.total_contacts} intro
                            </span>
                            {company.composition_summary.contacts_with_sent_outbound > 0 && (
                              <span className="od-count-chip" style={{ fontSize: 10 }}>
                                {company.composition_summary.contacts_with_sent_outbound} sent
                              </span>
                            )}
                            {company.composition_summary.blocked_already_used_contacts > 0 && (
                              <span className="od-count-chip" style={{ fontSize: 10, color: 'var(--od-text-muted)' }}>
                                {company.composition_summary.blocked_already_used_contacts} used
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>

        {/* Drag handle 2→3 */}
        <div className="od-resize-handle" onMouseDown={(e) => handleResizeStart(1, e)} />

        {/* ================================================
            Column 3: Employees
            ================================================ */}
        <div className="operator-desk__column">
          <div className="od-col-header">
            <span className="od-col-title">{t.employees}</span>
            {activeCompanyId && (
              <span className="od-count-chip">{employees.length}</span>
            )}
          </div>

          {/* Company context card */}
          {activeCompany && (
            <div className="od-company-context">
              {activeCompany.company_description && (
                <p className="od-company-context__desc" title={activeCompany.company_description}>
                  {truncate(activeCompany.company_description, 120)}
                </p>
              )}
              <div className="od-company-context__grid">
                {activeCompany.region && (
                  <div className="od-company-context__field">
                    <span className="od-company-context__label">{t.region}</span>
                    <span className="od-company-context__value">{activeCompany.region}</span>
                  </div>
                )}
                {activeCompany.employee_count != null && (
                  <div className="od-company-context__field">
                    <span className="od-company-context__label">{t.headcount}</span>
                    <span className="od-company-context__value">{activeCompany.employee_count}</span>
                  </div>
                )}
                {activeCompany.office_qualification && (
                  <div className="od-company-context__field">
                    <span className="od-company-context__label">{t.officeType}</span>
                    <span className="od-company-context__value">{activeCompany.office_qualification}</span>
                  </div>
                )}
                {activeCompany.enrichment.provider_hint && (
                  <div className="od-company-context__field">
                    <span className="od-company-context__label">{t.provider}</span>
                    <span className="od-company-context__value">{activeCompany.enrichment.provider_hint}</span>
                  </div>
                )}
                {activeCompany.enrichment.last_updated_at && (
                  <div className="od-company-context__field">
                    <span className="od-company-context__label">{t.lastEnriched}</span>
                    <span className="od-company-context__value">{formatDate(activeCompany.enrichment.last_updated_at)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="od-col-body">
            {!activeCompanyId && (
              <div className="od-placeholder">
                <div className="od-placeholder__dash" />
                <span className="od-placeholder__text">{t.noCompanySelected}</span>
              </div>
            )}
            {activeCompanyId && employees.length === 0 && (
              <div className="od-empty">
                <span className="od-empty__line" />
                <span className="od-empty__text">{t.noEmployees}</span>
                {drafts.length > 0 && (
                  <span className="od-empty__sub">
                    {drafts.length} drafts loaded, {drafts.filter(d => d.company_id).length} with company_id
                  </span>
                )}
                {drafts.length === 0 && selectedCampaignId && (
                  <span className="od-empty__sub">No drafts loaded for this campaign</span>
                )}
              </div>
            )}
            {activeCompanyId &&
              employees.map((emp) => {
                const isHovered = employeeHover.hoveredId === emp.contact_id;
                const isPinned = pinnedEmployeeId === emp.contact_id;
                return (
                  <div
                    key={emp.contact_id}
                    className={`od-employee-item${isHovered ? ' od-employee-item--hovered' : ''}${isPinned ? ' od-employee-item--pinned' : ''}`}
                    onMouseEnter={() => employeeHover.onMouseEnter(emp.contact_id)}
                    onMouseLeave={employeeHover.onMouseLeave}
                    onClick={() => setPinnedEmployeeId(emp.contact_id)}
                  >
                    <span className="od-employee-item__name" title={emp.full_name}>{emp.full_name}</span>
                    {emp.position && (
                      <span className="od-employee-item__role" title={emp.position}>
                        {truncate(emp.position, 30)}
                      </span>
                    )}
                    <div className="od-employee-item__foot">
                      <span
                        className={`od-send-dot ${emp.sendable ? 'od-send-dot--ok' : 'od-send-dot--warn'}`}
                        title={emp.sendable ? t.sendable : t.needsFix}
                      />
                      <CoverageDotsDisplay coverage={emp.draft_coverage} />
                      {emp.recipient_email && (
                        <span
                          className="od-count-chip"
                          style={{ fontSize: 9 }}
                          title={emp.recipient_email}
                        >
                          {emp.recipient_email_source ?? 'email'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Drag handle 3→4 */}
        <div className="od-resize-handle" onMouseDown={(e) => handleResizeStart(2, e)} />

        {/* ================================================
            Column 4: Messages
            ================================================ */}
        <div
          className="operator-desk__column"
          style={{ background: colors.bg }}
        >
          <div className="od-col-header" style={{ background: colors.bg }}>
            <span className="od-col-title">{t.messages}</span>
          </div>

          {/* Breadcrumb */}
          {(selectedCampaign || activeCompany || activeEmployee) && (
            <div style={{ padding: '0 10px 4px', fontSize: 10, color: 'var(--od-text-muted)', display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              {selectedCampaign && (
                <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={selectedCampaign.name}>{selectedCampaign.name}</span>
              )}
              {activeCompany && (
                <>
                  <span style={{ color: 'var(--od-border)' }}>/</span>
                  <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={activeCompany.company_name ?? undefined}>{activeCompany.company_name ?? '...'}</span>
                </>
              )}
              {activeEmployee && (
                <>
                  <span style={{ color: 'var(--od-border)' }}>/</span>
                  <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={activeEmployee.full_name}>{activeEmployee.full_name}</span>
                </>
              )}
            </div>
          )}

          <div className="od-messages-toolbar">
            {/* Status segmented control */}
            <div className="segmented-control">
              {(
                [
                  ['all', t.all],
                  ['generated', t.generated],
                  ['approved', t.approved],
                  ['rejected', t.rejected],
                  ['sent', t.sent],
                ] as [MessageStatusFilter, string][]
              ).map(([val, label]) => (
                <button
                  key={val}
                  className={`segmented-control__item${messageStatusFilter === val ? ' segmented-control__item--active' : ''}`}
                  onClick={() => setMessageStatusFilter(val)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Sequence segmented control */}
            <div className="segmented-control">
              {(
                [
                  ['all', t.all],
                  ['intro', t.email1],
                  ['bump', t.email2],
                ] as [MessageSequenceFilter, string][]
              ).map(([val, label]) => (
                <button
                  key={val}
                  className={`segmented-control__item${messageSequenceFilter === val ? ' segmented-control__item--active' : ''}`}
                  onClick={() => setMessageSequenceFilter(val)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="od-message-workspace">
            {activeEmployee && (
              <div className="od-employee-context">
                <div className="od-employee-context__header">
                  <div>
                    <div className="od-employee-context__eyebrow">{t.employee}</div>
                    <div className="od-employee-context__name">{activeEmployee.full_name}</div>
                    {activeEmployee.position && (
                      <div className="od-employee-context__role">{activeEmployee.position}</div>
                    )}
                  </div>
                  <div className="od-employee-context__badges">
                    <span
                      className={`od-status-badge ${
                        activeEmployee.sendable ? 'od-status-badge--ready' : 'od-status-badge--generating'
                      }`}
                    >
                      {activeEmployee.sendable ? t.sendable : t.needsFix}
                    </span>
                    <CoverageDotsDisplay coverage={activeEmployee.draft_coverage} />
                    <button
                      type="button"
                      className="od-view-trace-link"
                      onClick={() => setEmployeeDetailsOpen(true)}
                      style={{ marginLeft: 4 }}
                    >
                      {language === 'ru' ? 'Подробнее' : 'Details'}
                    </button>
                  </div>
                </div>
                <div className="od-employee-context__grid">
                  <div className="od-company-context__field">
                    <span className="od-company-context__label">{t.recipient}</span>
                    <span className="od-company-context__value">
                      {activeEmployee.recipient_email ?? '—'}
                      {activeEmployee.recipient_email_source ? ` (${activeEmployee.recipient_email_source})` : ''}
                    </span>
                  </div>
                  {activeEmployee.work_email && (
                    <div className="od-company-context__field">
                      <span className="od-company-context__label">{t.workEmail}</span>
                      <span className="od-company-context__value">{activeEmployee.work_email}</span>
                    </div>
                  )}
                  {activeEmployee.generic_email && (
                    <div className="od-company-context__field">
                      <span className="od-company-context__label">{t.genericEmail}</span>
                      <span className="od-company-context__value">{activeEmployee.generic_email}</span>
                    </div>
                  )}
                  <div className="od-company-context__field">
                    <span className="od-company-context__label">{t.delivery}</span>
                    <span className="od-company-context__value">{activeEmployee.sent_count}</span>
                  </div>
                  <div className="od-company-context__field">
                    <span className="od-company-context__label">{t.replies}</span>
                    <span className="od-company-context__value">{activeEmployee.reply_count}</span>
                  </div>
                </div>
              </div>
            )}

            {!activeEmployeeId && (
              <div className="od-placeholder" style={{ paddingTop: 48 }}>
                <div className="od-placeholder__dash" />
                <span className="od-placeholder__text">
                  {!selectedCampaignId
                    ? t.noCampaignSelected
                    : !activeCompanyId
                    ? t.noCompanySelected
                    : t.noEmployeeSelected}
                </span>
              </div>
            )}

            {activeEmployeeId && filteredMessages.length === 0 && (
              <div className="od-empty" style={{ paddingTop: 48 }}>
                <span className="od-empty__line" />
                {activeEmployeeDrafts.length === 0 ? (
                  <>
                    <span className="od-empty__text">
                      {language === 'ru'
                        ? 'Писем пока нет'
                        : 'No drafts yet for this employee'}
                    </span>
                    <span className="od-empty__sub">
                      {language === 'ru'
                        ? 'Сотрудник в аудитории кампании, но генерация ещё не создала письмо'
                        : 'Employee is in campaign audience but draft generation has not produced a message yet'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="od-empty__text">{t.noMessage}</span>
                    <span className="od-empty__sub">
                      {language === 'ru'
                        ? `${activeEmployeeDrafts.length} писем есть, но текущие фильтры скрывают их. Попробуйте сбросить фильтры.`
                        : `${activeEmployeeDrafts.length} draft${activeEmployeeDrafts.length !== 1 ? 's' : ''} exist, but current filters hide them. Try clearing filters above.`}
                    </span>
                  </>
                )}
              </div>
            )}

            {activeEmployeeId && filteredMessages.length > 0 && (
              <div className="od-message-list-layout">
                {/* Message list sidebar */}
                {filteredMessages.length > 1 && (
                  <>
                    <div className="od-message-list" style={{ maxHeight: msgListHeight, height: msgListHeight }}>
                      <div className="od-message-list__header">
                        <span className="od-count-chip">{filteredMessages.length}</span>
                      </div>
                      {filteredMessages.map((draft) => (
                        <div
                          key={draft.id}
                          className={`od-message-list-item${selectedMessageId === draft.id ? ' od-message-list-item--active' : ''}`}
                          onClick={() => setSelectedMessageId(draft.id)}
                        >
                          <span className="od-message-list-item__subject" title={draft.subject ?? '—'}>
                            {truncate(draft.subject ?? '—', 50)}
                          </span>
                          <div className="od-message-list-item__meta">
                            <StatusBadge status={draft.status} />
                            <span className="od-message-list-item__type">
                              {draft.email_type === 'bump' ? t.email2 : t.email1}
                            </span>
                            {draft.email_type === 'bump' && (draft.metadata as any)?.source?.includes('auto') && (
                              <span style={{ fontSize: 8, color: 'var(--od-orange)', fontWeight: 600 }}>AUTO</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="od-msg-resize-handle" onMouseDown={handleMsgResizeStart} />
                  </>
                )}

                {/* Selected message detail */}
                {selectedMessage && (
                  <div className="od-message-detail">
                    <MessageCard
                      draft={selectedMessage}
                      t={t}
                      onApprove={(id) => handleReview(id, { status: 'approved' })}
                      onReject={(id, metadata) => handleReview(id, { status: 'rejected', metadata })}
                      onSave={handleSaveDraft}
                      onViewTrace={openDrawer}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================================================
          Drawer overlay + slide-over
          ================================================ */}
      <div
        className={`od-drawer-overlay${drawerOpen ? ' od-drawer-overlay--open' : ''}`}
        onClick={() => setDrawerOpen(false)}
      />
      <div className={`od-drawer${drawerOpen ? ' od-drawer--open' : ''}`}>
        <div className="od-drawer__header">
          <h3 className="od-drawer__title">{t.traceTitle}</h3>
          <button className="od-drawer__close" onClick={() => setDrawerOpen(false)}>
            {t.close}
          </button>
        </div>
        <div className="od-drawer__body">
          {drawerDraftId && (
            <TracePanel
              draft={drafts.find((d) => d.id === drawerDraftId) ?? null}
              outbound={drawerOutbound}
              events={drawerEvents}
              t={t}
            />
          )}
        </div>
      </div>

      {/* Launch drawer */}
      <CampaignLaunchDrawer
        open={launchOpen}
        onClose={() => setLaunchOpen(false)}
        segments={launchSegments}
        mailboxes={launchMailboxes}
        language={language}
        onLaunched={handleLaunched}
      />

      {selectedCampaignId && (
        <CampaignAttachCompaniesDrawer
          open={attachOpen}
          campaignId={selectedCampaignId}
          onClose={() => setAttachOpen(false)}
          onAttached={() => {
            // Refresh companies and audit for the selected campaign
            if (selectedCampaignId) {
              fetchCampaignDetail(selectedCampaignId)
                .then((v) => setCompanies(v.companies))
                .catch(() => {});
              fetchCampaignAudit(selectedCampaignId)
                .then((data) => setAuditView(data))
                .catch(() => {});
            }
          }}
          language={language}
        />
      )}

      {/* Employee details drawer */}
      <CampaignEmployeeDetailsDrawer
        open={employeeDetailsOpen}
        employee={activeEmployee}
        companyName={activeCompany?.company_name}
        drafts={activeEmployeeDrafts}
        blockReasons={
          activeEmployeeId && activeCompany?.employees
            ? activeCompany.employees.find((e) => e.contact_id === activeEmployeeId)?.block_reasons
            : undefined
        }
        eligibleForNewIntro={
          activeEmployeeId && activeCompany?.employees
            ? activeCompany.employees.find((e) => e.contact_id === activeEmployeeId)?.eligible_for_new_intro
            : undefined
        }
        exposureSummary={
          activeEmployeeId && activeCompany?.employees
            ? activeCompany.employees.find((e) => e.contact_id === activeEmployeeId)?.exposure_summary
            : undefined
        }
        executionExposures={
          activeEmployeeId && activeCompany?.employees
            ? activeCompany.employees.find((e) => e.contact_id === activeEmployeeId)?.execution_exposures
            : undefined
        }
        contactEvents={
          activeEmployeeId
            ? events.filter((e) => e.contact_id === activeEmployeeId)
            : undefined
        }
        onClose={() => setEmployeeDetailsOpen(false)}
        language={language}
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

// ============================================================
// ContextRow helper
// ============================================================

function ContextRow({ label, value }: { label: string; value: string }) {
  const isNA = value === 'n/a' || value === 'н/д';
  return (
    <div className="od-context-row">
      <span className="od-context-row__label">{label}</span>
      <span className={`od-context-row__value${isNA ? ' od-context-row__value--na' : ''}`}>
        {value}
      </span>
    </div>
  );
}

// ============================================================
// MessageCard
// ============================================================

interface MessageCardProps {
  draft: DraftRow;
  t: Record<string, string>;
  onApprove: (id: string) => void;
  onReject: (id: string, metadata: Record<string, unknown>) => void | Promise<void>;
  onSave: (id: string, subject: string, body: string) => Promise<void>;
  onViewTrace: (id: string) => void;
}

function MessageCard({ draft, t, onApprove, onReject, onSave, onViewTrace }: MessageCardProps) {
  const isSent = draft.status === 'sent';
  const missingRecipient = !draft.recipient_email;
  const reviewMeta = getDraftReviewMeta(draft);
  const reviewActions = getDraftReviewActions(draft.status);

  // ---- Edit mode ----
  const [editing, setEditing] = useState(false);
  const [editSubject, setEditSubject] = useState(draft.subject ?? '');
  const [editBody, setEditBody] = useState(draft.body ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditSubject(draft.subject ?? '');
    setEditBody(draft.body ?? '');
    setEditing(false);
  }, [draft.id, draft.subject, draft.body]);

  const handleStartEdit = () => {
    setEditSubject(draft.subject ?? '');
    setEditBody(draft.body ?? '');
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditSubject(draft.subject ?? '');
    setEditBody(draft.body ?? '');
    setEditing(false);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await onSave(draft.id, editSubject, editBody);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = editSubject !== (draft.subject ?? '') || editBody !== (draft.body ?? '');

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReasonCode, setRejectReasonCode] = useState<DraftReviewReasonCode | ''>('');
  const [rejectReasonText, setRejectReasonText] = useState('');
  const [rejectExtraCodes, setRejectExtraCodes] = useState<DraftReviewReasonCode[]>([]);
  const [rejectValidationError, setRejectValidationError] = useState<string | null>(null);

  useEffect(() => {
    setRejectOpen(false);
    setRejectReasonCode('');
    setRejectReasonText('');
    setRejectExtraCodes([]);
    setRejectValidationError(null);
  }, [draft.id]);

  const toggleRejectExtraCode = (code: DraftReviewReasonCode) => {
    setRejectExtraCodes((current) =>
      current.includes(code) ? current.filter((value) => value !== code) : [...current, code]
    );
  };

  const handleSaveRejection = async () => {
    if (!rejectReasonCode) {
      setRejectValidationError(t.pickRejectReason);
      return;
    }
    if (rejectReasonCode === 'other' && rejectReasonText.trim().length === 0) {
      setRejectValidationError(t.noteRequiredForOther);
      return;
    }

    const reasonCodes = Array.from(
      new Set([rejectReasonCode, ...rejectExtraCodes.filter((code) => code !== rejectReasonCode)])
    );

    await onReject(draft.id, {
      review_reason_code: rejectReasonCode,
      review_reason_codes: reasonCodes,
      review_reason_text: rejectReasonText.trim() || undefined,
    });

    setRejectOpen(false);
    setRejectReasonCode('');
    setRejectReasonText('');
    setRejectExtraCodes([]);
    setRejectValidationError(null);
  };

  return (
    <div className="od-message-card">
      <div className="od-message-card__header">
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input
              className="od-edit-subject"
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              placeholder={t.subject}
            />
          ) : (
            <p className="od-message-subject">{draft.subject ?? '—'}</p>
          )}
          {missingRecipient && !editing && (
            <span
              className="od-status-badge od-status-badge--generating"
              style={{ marginTop: 6, display: 'inline-flex' }}
            >
              Missing recipient
            </span>
          )}
          {draft.email_type === 'bump' && !editing && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {(draft.metadata as any)?.source?.includes('auto') && (
                <span className="od-count-chip" style={{ fontSize: 9, color: 'var(--od-orange)' }}>Auto-generated</span>
              )}
              {draft.status === 'approved' && draft.updated_at && (() => {
                const d = new Date(draft.updated_at);
                const now = new Date();
                return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
              })() && (
                <span className="od-count-chip" style={{ fontSize: 9, color: 'var(--od-orange)' }}>
                  {language === 'ru' ? 'Отправка завтра' : 'Sendable tomorrow'}
                </span>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <StatusBadge status={draft.status} />
          {!isSent && !editing && (
            <button className="od-view-trace-link" onClick={handleStartEdit}>
              {t.edit}
            </button>
          )}
          <button
            className="od-view-trace-link"
            onClick={() => onViewTrace(draft.id)}
          >
            {t.viewTrace}
          </button>
        </div>
      </div>

      <div className="od-message-card__body">
        {editing ? (
          <textarea
            className="od-edit-body"
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            placeholder={t.body}
          />
        ) : (
          <pre className="od-message-body-text">{draft.body ?? '—'}</pre>
        )}
      </div>

      <div className="od-message-card__meta">
        {draft.pattern_mode && (
          <div className="od-message-meta-item">
            <span className="od-message-meta-label">{t.pattern}</span>
            <span className="od-message-meta-value">{draft.pattern_mode}</span>
          </div>
        )}
        {draft.email_type && (
          <div className="od-message-meta-item">
            <span className="od-message-meta-label">Sequence</span>
            <span className="od-message-meta-value">{draft.email_type}</span>
          </div>
        )}
        <div className="od-message-meta-item">
          <span className="od-message-meta-label">{t.recipient}</span>
          <span
            className={`od-message-meta-value${missingRecipient ? ' od-message-meta-value--warn' : ''}`}
          >
            {draft.recipient_email ?? '—'}
            {draft.recipient_email_source ? ` (${draft.recipient_email_source})` : ''}
          </span>
        </div>
        {draft.updated_at && (
          <div className="od-message-meta-item">
            <span className="od-message-meta-label">{t.updated}</span>
            <span className="od-message-meta-value">{formatDate(draft.updated_at)}</span>
          </div>
        )}
        {reviewMeta.primaryCode && (
          <div className="od-message-meta-item od-message-meta-item--wide">
            <span className="od-message-meta-label">{t.reviewMeta}</span>
            <span className="od-message-meta-value">
              {reviewMeta.primaryLabel ?? reviewMeta.primaryCode}
              {reviewMeta.reasonCodes
                .filter((code) => code !== reviewMeta.primaryCode)
                .map((code) => `, ${getDraftReviewReasonLabel(code) ?? code}`)
                .join('')}
            </span>
            {reviewMeta.reasonText && (
              <span className="od-message-meta-value od-message-meta-value--muted">
                {reviewMeta.reasonText}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="od-message-card__actions">
        {editing ? (
          <>
            <button
              className="od-btn od-btn--approve"
              onClick={handleSaveEdit}
              disabled={saving || !hasChanges}
            >
              {saving ? t.saving : t.save}
            </button>
            <button
              className="od-btn od-btn--ghost"
              onClick={handleCancelEdit}
              disabled={saving}
            >
              {t.cancel}
            </button>
          </>
        ) : isSent ? (
          <span className="od-sent-lock">{t.sentLocked}</span>
        ) : (
          <>
            {reviewActions.canApprove && (
              <button
                className="od-btn od-btn--approve"
                onClick={() => onApprove(draft.id)}
              >
                {t.approve}
              </button>
            )}
            {reviewActions.canReject && (
              <button
                className="od-btn od-btn--reject"
                onClick={() => {
                  setRejectOpen(true);
                  setRejectValidationError(null);
                }}
              >
                {t.reject}
              </button>
            )}
          </>
        )}
      </div>

      {rejectOpen && !isSent && (
        <div className="od-message-card__review-form">
          <label className="od-message-card__field">
            <span className="od-message-meta-label">{t.rejectReason}</span>
            <select
              className="od-search__input"
              value={rejectReasonCode}
              onChange={(event) => {
                const next = event.target.value;
                setRejectReasonCode(isDraftReviewReasonCode(next) ? next : '');
                setRejectValidationError(null);
              }}
            >
              <option value="">{t.selectReason}</option>
              {draftReviewReasonOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="od-message-card__reason-tags">
            {draftReviewReasonOptions
              .filter((option) => option.code !== rejectReasonCode)
              .map((option) => (
                <button
                  key={option.code}
                  type="button"
                  className={`od-btn ${rejectExtraCodes.includes(option.code) ? '' : 'od-btn--ghost'}`}
                  onClick={() => toggleRejectExtraCode(option.code)}
                  title={option.description}
                >
                  {option.label}
                </button>
              ))}
          </div>

          <label className="od-message-card__field">
            <span className="od-message-meta-label">{t.reviewNote}</span>
            <textarea
              className="od-message-card__textarea"
              rows={4}
              value={rejectReasonText}
              onChange={(event) => {
                setRejectReasonText(event.target.value);
                setRejectValidationError(null);
              }}
            />
          </label>

          {rejectValidationError && (
            <div className="od-message-card__review-error">{rejectValidationError}</div>
          )}

          <div className="od-message-card__actions">
            <button className="od-btn od-btn--ghost" onClick={() => setRejectOpen(false)}>
              {t.cancel}
            </button>
            <button className="od-btn od-btn--reject" onClick={handleSaveRejection}>
              {t.saveRejection}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TracePanel
// ============================================================

interface TracePanelProps {
  draft: DraftRow | null;
  outbound: CampaignOutbound | null;
  events: CampaignEvent[];
  t: Record<string, string>;
}

function TracePanel({ draft, outbound, events, t }: TracePanelProps) {
  return (
    <div>
      {/* Draft step */}
      <TraceStep
        type="Draft"
        title={draft?.subject ?? '—'}
        details={[
          draft?.status ? `Status: ${draft.status}` : null,
          draft?.pattern_mode ? `Pattern: ${draft.pattern_mode}` : null,
          draft?.email_type ? `Type: ${draft.email_type}` : null,
          draft?.created_at ? `Created: ${formatDate(draft.created_at)}` : null,
        ]}
        active={!!draft}
        hasConnector
      />

      {/* Outbound step */}
      <TraceStep
        type="Outbound"
        title={outbound ? `${outbound.provider} / ${outbound.status ?? '—'}` : t.noDraftYet}
        details={[
          outbound?.sent_at ? `Sent: ${formatDate(outbound.sent_at)}` : null,
          outbound?.sender_identity ? `From: ${outbound.sender_identity}` : null,
          outbound?.recipient_email ? `To: ${outbound.recipient_email}` : null,
          outbound?.error ? `Error: ${outbound.error}` : null,
        ]}
        active={!!outbound}
        hasConnector
      />

      {/* Event steps */}
      {events.length === 0 && (
        <TraceStep
          type="Events"
          title={t.noEventYet}
          details={[]}
          active={false}
          hasConnector={false}
        />
      )}
      {events.map((ev, idx) => (
        <TraceStep
          key={ev.id}
          type={ev.event_type}
          title={ev.outcome_classification ?? ev.event_type}
          details={[
            ev.occurred_at ? `At: ${formatDate(ev.occurred_at)}` : null,
            ev.provider ? `Provider: ${ev.provider}` : null,
          ]}
          active
          hasConnector={idx < events.length - 1}
        />
      ))}
    </div>
  );
}

function TraceStep({
  type,
  title,
  details,
  active,
  hasConnector,
}: {
  type: string;
  title: string;
  details: (string | null)[];
  active: boolean;
  hasConnector: boolean;
}) {
  const filtered = details.filter(Boolean) as string[];
  return (
    <div className="od-trace-step">
      <div className="od-trace-step__connector">
        <div
          className={`od-trace-step__dot${active ? '' : ' od-trace-step__dot--muted'}`}
        />
        {hasConnector && <div className="od-trace-step__line" />}
      </div>
      <div className="od-trace-step__content">
        <div className="od-trace-step__type">{type}</div>
        <p className="od-trace-step__title">{title}</p>
        {filtered.map((d) => (
          <div key={d} className="od-trace-step__detail">
            {d}
          </div>
        ))}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchActiveDraftGenerationJob,
  fetchDraftGenerationJobStatus,
  startDraftGenerationJob,
  type DraftGenerationJobStatusResponse,
} from '../apiClient';

const translations: Record<string, Record<string, string>> = {
  en: {
    title: 'Draft generation',
    preview: 'Check',
    confirm: 'Generate',
    cancel: 'Cancel',
    running: 'Running...',
    generated: 'generated',
    skipped: 'skipped',
    failed: 'failed',
    progress: 'Progress',
    current: 'Now',
    eligible: 'eligible',
    done: 'Done',
    selectCampaign: 'Select a campaign',
    batch: 'Batch',
    batchDefault: '20 = default',
    batchAll: '0 = all eligible',
    model: 'Model',
    selected: 'selected',
    missingIntros: 'Missing intros',
    generateSelected: 'Generate for selected',
    generateMissing: 'Generate missing intros',
    job: 'job',
    event_started: 'Started',
    event_company_started: 'Company',
    event_recipient_started: 'Recipient',
    event_draft_created: 'Draft created',
    event_skipped: 'Skipped',
    event_failed: 'Failed',
    event_completed: 'Completed',
  },
  ru: {
    title: 'Генерация писем',
    preview: 'Проверить',
    confirm: 'Запустить',
    cancel: 'Отмена',
    running: 'Запуск...',
    generated: 'генерировано',
    skipped: 'пропущено',
    failed: 'ошибок',
    progress: 'Прогресс',
    current: 'Сейчас',
    eligible: 'доступно',
    done: 'Готово',
    selectCampaign: 'Выберите кампанию',
    batch: 'Пакет',
    batchDefault: '20 = по умолчанию',
    batchAll: '0 = все доступные',
    model: 'Модель',
    selected: 'выбрано',
    missingIntros: 'Нет intro',
    generateSelected: 'Сгенерировать выбранные',
    generateMissing: 'Сгенерировать без intro',
    job: 'job',
    event_started: 'Старт',
    event_company_started: 'Компания',
    event_recipient_started: 'Контакт',
    event_draft_created: 'Черновик создан',
    event_skipped: 'Пропущено',
    event_failed: 'Ошибка',
    event_completed: 'Завершено',
  },
};

function getT(language: string) {
  return translations[language] ?? translations['en'];
}

function parseLimit(raw: string): number {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0) return 20;
  return n;
}

type Phase = 'idle' | 'previewing' | 'previewed' | 'generating' | 'done';

type ProgressEvent = Record<string, unknown> & { event?: string };

function getProgressEvents(status: DraftGenerationJobStatusResponse | null): ProgressEvent[] {
  const events = status?.result?.progress_events;
  if (!Array.isArray(events)) return [];
  return events.filter((event): event is ProgressEvent => Boolean(event) && typeof event === 'object');
}

function toDisplayValue(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function formatProgressEvent(event: ProgressEvent | null, t: Record<string, string>): string | null {
  if (!event?.event) return null;
  const label = t[`event_${event.event}`] ?? event.event;

  if (event.event === 'company_started') {
    const company = toDisplayValue(event.company_name) ?? toDisplayValue(event.company_id);
    const eligible = typeof event.eligible_recipients === 'number'
      ? ` · ${event.eligible_recipients} ${t.eligible}`
      : '';
    return company ? `${label}: ${company}${eligible}` : label;
  }

  if (event.event === 'recipient_started') {
    const person = toDisplayValue(event.full_name) ?? toDisplayValue(event.email) ?? toDisplayValue(event.contact_id);
    const position = toDisplayValue(event.position);
    return person ? `${label}: ${person}${position ? ` · ${position}` : ''}` : label;
  }

  if (event.event === 'draft_created') {
    const subject = toDisplayValue(event.subject) ?? toDisplayValue(event.draft_id);
    return subject ? `${label}: ${subject}` : label;
  }

  if (event.event === 'skipped') {
    const reason = toDisplayValue(event.reason);
    return reason ? `${label}: ${reason}` : label;
  }

  if (event.event === 'failed') {
    const error = toDisplayValue(event.error_code) ?? toDisplayValue(event.error);
    return error ? `${label}: ${error}` : label;
  }

  return label;
}

export function CampaignDraftGenerateCard({
  campaignId,
  language = 'en',
  selectedCompanyIds = [],
  missingIntroCompanyIds = [],
  onGenerated,
}: {
  campaignId?: string;
  language?: string;
  selectedCompanyIds?: string[];
  missingIntroCompanyIds?: string[];
  onGenerated?: () => void;
}) {
  const t = getT(language);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<{ generated: number; skipped: number; failed: number; dryRun: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitInput, setLimitInput] = useState('20');
  const [draftsModel, setDraftsModel] = useState<'opus' | 'sonnet'>('opus');
  const [jobStatus, setJobStatus] = useState<DraftGenerationJobStatusResponse | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const limit = parseLimit(limitInput);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const applyJobStatus = useCallback((status: DraftGenerationJobStatusResponse) => {
    setJobStatus(status);
    setResult({
      generated: status.generated,
      skipped: status.skipped,
      failed: status.failed,
      dryRun: status.dryRun,
    });
    if (status.status === 'completed') {
      stopPolling();
      onGenerated?.();
      setPhase(status.dryRun ? 'previewed' : 'done');
    } else if (status.status === 'failed') {
      stopPolling();
      setError(status.errors[0] ? String(status.errors[0]) : 'Generation failed');
      setPhase(status.dryRun ? 'idle' : 'previewed');
    } else {
      setPhase(status.dryRun ? 'previewing' : 'generating');
    }
  }, [onGenerated, stopPolling]);

  const pollJob = useCallback(async (jobId: string) => {
    try {
      applyJobStatus(await fetchDraftGenerationJobStatus(jobId));
    } catch (err: unknown) {
      stopPolling();
      setError(err instanceof Error ? err.message : 'Failed to fetch generation status');
      setPhase('idle');
    }
  }, [applyJobStatus, stopPolling]);

  const beginPolling = useCallback((jobId: string) => {
    stopPolling();
    void pollJob(jobId);
    pollTimerRef.current = setInterval(() => {
      void pollJob(jobId);
    }, 2500);
  }, [pollJob, stopPolling]);

  useEffect(() => stopPolling, [stopPolling]);

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    void (async () => {
      try {
        const active = await fetchActiveDraftGenerationJob(campaignId);
        if (!cancelled && active) {
          applyJobStatus(active);
          beginPolling(active.jobId);
        }
      } catch {
        // Active job recovery is opportunistic; normal controls remain available if it fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyJobStatus, beginPolling, campaignId]);

  if (!campaignId) {
    return (
      <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
        <h3 className="od-context-block__title">{t.title}</h3>
        <span style={{ fontSize: 12, color: 'var(--od-text-muted)' }}>{t.selectCampaign}</span>
      </div>
    );
  }

  const handlePreview = async () => {
    setPhase('previewing');
    setError(null);
    try {
      const started = await startDraftGenerationJob(campaignId, { dryRun: true, limit, draftsModel });
      beginPolling(started.jobId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Preview failed');
      setPhase('idle');
    }
  };

  const handleConfirm = async () => {
    setPhase('generating');
    setError(null);
    try {
      const started = await startDraftGenerationJob(campaignId, { dryRun: false, limit, draftsModel });
      beginPolling(started.jobId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setPhase('previewed');
    }
  };

  const handleReset = () => {
    stopPolling();
    setPhase('idle');
    setResult(null);
    setJobStatus(null);
    setError(null);
  };

  const handleGenerateCompanyBatch = async (companyIds: string[]) => {
    if (companyIds.length === 0) return;
    setPhase('generating');
    setError(null);
    try {
      const started = await startDraftGenerationJob(campaignId, {
        dryRun: false,
        limit: 0,
        companyIds,
        draftsModel,
      });
      beginPolling(started.jobId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setPhase('idle');
    }
  };

  const busy = phase === 'previewing' || phase === 'generating';
  const hasSelectedCompanies = selectedCompanyIds.length > 0;
  const hasMissingIntros = missingIntroCompanyIds.length > 0;
  const processedCount = jobStatus ? jobStatus.generated + jobStatus.skipped + jobStatus.failed : 0;
  const totalRecipients = jobStatus?.totalRecipients ?? jobStatus?.requestedContactCount ?? null;
  const progressPct = totalRecipients && totalRecipients > 0
    ? Math.min(100, Math.round((processedCount / totalRecipients) * 100))
    : 0;
  const progressEvents = getProgressEvents(jobStatus);
  const latestProgressEvent = progressEvents[progressEvents.length - 1] ?? null;
  const latestProgressLabel = formatProgressEvent(latestProgressEvent, t);

  return (
    <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
      <h3 className="od-context-block__title">{t.title}</h3>

      {error && (
        <div style={{ fontSize: 11, color: 'var(--od-error)', marginBottom: 6 }}>{error}</div>
      )}
      {jobStatus && busy && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--od-text-muted)', marginBottom: 4 }}>
            {t.job} {jobStatus.jobId.slice(0, 8)} · {jobStatus.generated} {t.generated}
            {jobStatus.skipped > 0 ? ` · ${jobStatus.skipped} ${t.skipped}` : ''}
            {jobStatus.failed > 0 ? ` · ${jobStatus.failed} ${t.failed}` : ''}
          </div>
          {totalRecipients !== null && (
            <div aria-label="draft generation progress">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 10, color: 'var(--od-text-muted)', marginBottom: 3 }}>
                <span>{t.progress}</span>
                <span>{processedCount} / {totalRecipients}</span>
              </div>
              <div style={{ height: 5, borderRadius: 999, overflow: 'hidden', background: 'color-mix(in srgb, var(--od-border) 70%, transparent)' }}>
                <div
                  style={{
                    width: `${progressPct}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: 'var(--od-orange)',
                    transition: 'width 180ms ease',
                  }}
                />
              </div>
            </div>
          )}
          {latestProgressLabel && (
            <div style={{ marginTop: 5, fontSize: 10, lineHeight: 1.35, color: 'var(--od-text-muted)' }}>
              {t.current}: {latestProgressLabel}
            </div>
          )}
        </div>
      )}

      {/* Batch size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--od-text-muted)' }}>{t.batch}</span>
        <input
          type="number"
          min={0}
          step={1}
          value={limitInput}
          onChange={(e) => setLimitInput(e.target.value)}
          onBlur={() => setLimitInput(String(limit))}
          disabled={busy}
          style={{
            width: 52,
            fontSize: 12,
            padding: '3px 6px',
            borderRadius: 4,
            border: '1px solid var(--od-border)',
            background: 'var(--od-card)',
            color: 'var(--od-text)',
            textAlign: 'center',
          }}
        />
        <span style={{ fontSize: 9, color: 'var(--od-text-muted)' }}>
          {limit === 0 ? t.batchAll : limit === 20 ? t.batchDefault : `${limit} companies`}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--od-text-muted)' }}>{t.model}</span>
        <select
          value={draftsModel}
          onChange={(e) => setDraftsModel(e.target.value === 'sonnet' ? 'sonnet' : 'opus')}
          disabled={busy}
          style={{
            fontSize: 11,
            padding: '3px 6px',
            borderRadius: 4,
            border: '1px solid var(--od-border)',
            background: 'var(--od-card)',
            color: 'var(--od-text)',
          }}
        >
          <option value="opus">opus</option>
          <option value="sonnet">sonnet</option>
        </select>
        {hasSelectedCompanies && (
          <span className="od-count-chip" style={{ fontSize: 10 }}>
            {selectedCompanyIds.length} {t.selected}
          </span>
        )}
        {hasMissingIntros && (
          <span className="od-count-chip" style={{ fontSize: 10, color: 'var(--od-warning)' }}>
            {missingIntroCompanyIds.length} {t.missingIntros}
          </span>
        )}
      </div>

      {/* Result chips */}
      {result && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          <span className="od-count-chip" style={{ fontSize: 10, color: result.generated > 0 ? 'var(--od-success)' : 'var(--od-text-muted)' }}>
            {result.generated} {t.generated}
          </span>
          {result.skipped > 0 && (
            <span className="od-count-chip" style={{ fontSize: 10, color: 'var(--od-text-muted)' }}>
              {result.skipped} {t.skipped}
            </span>
          )}
          {result.failed > 0 && (
            <span className="od-count-chip" style={{ fontSize: 10, color: 'var(--od-error)' }}>
              {result.failed} {t.failed}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {phase === 'idle' && (
          <>
            <button type="button" className="od-btn" style={{ fontSize: 11, padding: '4px 12px', background: 'color-mix(in srgb, var(--od-warning) 12%, transparent)', color: 'var(--od-warning)', border: '1px solid var(--od-warning)' }} onClick={handlePreview}>
              {t.preview}
            </button>
            <button type="button" className="od-btn od-btn--approve" style={{ fontSize: 11, padding: '4px 12px', opacity: hasSelectedCompanies ? 1 : 0.5 }} onClick={() => void handleGenerateCompanyBatch(selectedCompanyIds)} disabled={!hasSelectedCompanies || busy}>
              {t.generateSelected}
            </button>
            <button type="button" className="od-btn od-btn--ghost" style={{ fontSize: 11, padding: '4px 12px', opacity: hasMissingIntros ? 1 : 0.5 }} onClick={() => void handleGenerateCompanyBatch(missingIntroCompanyIds)} disabled={!hasMissingIntros || busy}>
              {t.generateMissing}
            </button>
          </>
        )}
        {busy && (
          <span style={{ fontSize: 11, color: 'var(--od-text-muted)' }}>{t.running}</span>
        )}
        {phase === 'previewed' && (
          <>
            <button type="button" className="od-btn od-btn--approve" style={{ fontSize: 11, padding: '4px 12px' }} onClick={handleConfirm}>
              {t.confirm}
            </button>
            <button type="button" className="od-btn od-btn--ghost" style={{ fontSize: 11, padding: '4px 12px' }} onClick={handleReset}>
              {t.cancel}
            </button>
          </>
        )}
        {phase === 'done' && (
          <button type="button" className="od-btn od-btn--ghost" style={{ fontSize: 11, padding: '4px 12px' }} onClick={handleReset}>
            {t.done}
          </button>
        )}
      </div>
    </div>
  );
}

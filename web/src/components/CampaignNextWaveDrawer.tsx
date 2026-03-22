import { useEffect, useState } from 'react';
import {
  createNextWave,
  fetchNextWavePreview,
  type CampaignNextWaveCreateResult,
  type CampaignNextWavePreviewResult,
} from '../apiClient';

const translations: Record<string, Record<string, string>> = {
  en: {
    title: 'Create next wave',
    close: 'Close',
    loading: 'Loading preview...',
    source: 'Source campaign',
    name: 'New campaign name',
    namePlaceholder: 'e.g. Wave 2',
    candidates: 'Candidates',
    eligible: 'Eligible',
    blocked: 'Blocked',
    candidatesHelp: 'Contacts from the same saved segment baseline plus carried-over manual additions from the source wave.',
    eligibleHelp: 'Contacts that can be included in the new wave right now.',
    blockedHelp: 'Contacts excluded from the new wave because of suppression, recent contact, missing email, or prior use.',
    zeroEligibleHint: 'This source wave has no remaining eligible contacts in the current baseline.',
    offer: 'Offer',
    hypothesis: 'Hypothesis',
    sendPolicy: 'Send policy',
    senders: 'Senders',
    domains: 'Domains',
    create: 'Create wave',
    creating: 'Creating...',
    success: 'Wave created',
    campaignId: 'Campaign ID',
    done: 'Done',
    suppressed_contact: 'Suppressed',
    already_contacted_recently: 'Contacted recently',
    no_sendable_email: 'No sendable email',
    already_in_target_wave: 'Already in target',
    already_used_in_source_wave: 'Used in source',
  },
  ru: {
    title: 'Создать следующую волну',
    close: 'Закрыть',
    loading: 'Загрузка предпросмотра...',
    source: 'Исходная кампания',
    name: 'Название новой кампании',
    namePlaceholder: 'напр. Волна 2',
    candidates: 'Кандидаты',
    eligible: 'Доступно',
    blocked: 'Заблокировано',
    candidatesHelp: 'Контакты из того же сохранённого сегмента плюс перенесённые manual attach из исходной волны.',
    eligibleHelp: 'Контакты, которые можно включить в новую волну прямо сейчас.',
    blockedHelp: 'Контакты, исключённые из новой волны из-за suppression, недавнего контакта, отсутствия email или предыдущего использования.',
    zeroEligibleHint: 'В текущем baseline для этой волны не осталось доступных контактов.',
    offer: 'Оффер',
    hypothesis: 'Гипотеза',
    sendPolicy: 'Политика отправки',
    senders: 'Отправители',
    domains: 'Домены',
    create: 'Создать волну',
    creating: 'Создание...',
    success: 'Волна создана',
    campaignId: 'ID кампании',
    done: 'Готово',
    suppressed_contact: 'Подавлено',
    already_contacted_recently: 'Недавно контактировали',
    no_sendable_email: 'Нет email',
    already_in_target_wave: 'Уже в целевой волне',
    already_used_in_source_wave: 'Использован в исходной',
  },
};

function getT(language: string) {
  return translations[language] ?? translations['en'];
}

type Step = 'preview' | 'success';

export function CampaignNextWaveDrawer({
  open,
  campaignId,
  campaignName,
  onClose,
  onCreated,
  language = 'en',
}: {
  open: boolean;
  campaignId: string;
  campaignName?: string;
  onClose: () => void;
  onCreated?: (result: CampaignNextWaveCreateResult) => void;
  language?: string;
}) {
  const t = getT(language);
  const [step, setStep] = useState<Step>('preview');
  const [preview, setPreview] = useState<CampaignNextWavePreviewResult | null>(null);
  const [result, setResult] = useState<CampaignNextWaveCreateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    if (!open || !campaignId) return;
    let cancelled = false;
    setStep('preview');
    setPreview(null);
    setResult(null);
    setError(null);
    setLoading(true);
    setName(campaignName ? `${campaignName} — Wave 2` : '');

    fetchNextWavePreview(campaignId)
      .then((res) => { if (!cancelled) setPreview(res); })
      .catch((err) => { if (!cancelled) setError(err?.message ?? 'Preview failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [open, campaignId]);

  const handleCreate = async () => {
    if (!name.trim() || !campaignId) return;
    setCreating(true);
    setError(null);
    try {
      const res = await createNextWave({
        sourceCampaignId: campaignId,
        name: name.trim(),
        createdBy: 'web-ui',
        offerId: preview?.defaults.offerId ?? undefined,
        icpHypothesisId: preview?.defaults.icpHypothesisId ?? undefined,
      });
      setResult(res);
      setStep('success');
      onCreated?.(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setStep('preview');
    setPreview(null);
    setResult(null);
    setError(null);
    setName('');
    onClose();
  };

  if (!open) return null;

  const BLOCKED_REASON_COLORS: Record<string, string> = {
    suppressed_contact: 'var(--od-error)',
    no_sendable_email: 'var(--od-warning)',
    already_contacted_recently: 'var(--od-text-muted)',
    already_in_target_wave: 'var(--od-text-muted)',
    already_used_in_source_wave: 'var(--od-text-muted)',
  };

  return (
    <>
      <div className="od-drawer-overlay od-drawer-overlay--open" onClick={handleClose} />
      <div className="od-drawer od-drawer--open" style={{ maxWidth: 420, width: '100%' }}>
        <div className="od-drawer__header">
          <h3 className="od-drawer__title">{t.title}</h3>
          <button className="od-drawer__close" onClick={handleClose}>{t.close}</button>
        </div>

        <div className="od-drawer__body" style={{ padding: 16 }}>
          {error && (
            <div className="od-error-banner" role="alert" style={{ marginBottom: 12 }}>{error}</div>
          )}

          {/* Loading */}
          {loading && !preview && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="od-skeleton" style={{ height: 14, width: '60%' }} />
              <span className="od-skeleton" style={{ height: 12, width: '40%' }} />
              <span className="od-skeleton" style={{ height: 12, width: '50%' }} />
              <p style={{ fontSize: 12, color: 'var(--od-text-muted)', marginTop: 4 }}>{t.loading}</p>
            </div>
          )}

          {/* Preview step */}
          {step === 'preview' && preview && (
            <>
              {/* Source */}
              <div className="od-context-row">
                <span className="od-context-row__label">{t.source}</span>
                <span className="od-context-row__value">{preview.sourceCampaign.name}</span>
              </div>

              {/* Counts */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
                <span className="od-count-chip">{preview.summary.candidateContactCount} {t.candidates.toLowerCase()}</span>
                <span className="od-count-chip" style={{ color: preview.summary.eligibleContactCount > 0 ? 'var(--od-success)' : 'var(--od-warning)' }}>
                  {preview.summary.eligibleContactCount} {t.eligible.toLowerCase()}
                </span>
                {preview.summary.blockedContactCount > 0 && (
                  <span className="od-count-chip" style={{ color: 'var(--od-warning)' }}>
                    {preview.summary.blockedContactCount} {t.blocked.toLowerCase()}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--od-text-muted)', lineHeight: 1.4 }}>
                  <strong style={{ color: 'var(--od-text)' }}>{t.candidates}:</strong> {t.candidatesHelp}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--od-text-muted)', lineHeight: 1.4 }}>
                  <strong style={{ color: 'var(--od-text)' }}>{t.eligible}:</strong> {t.eligibleHelp}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--od-text-muted)', lineHeight: 1.4 }}>
                  <strong style={{ color: 'var(--od-text)' }}>{t.blocked}:</strong> {t.blockedHelp}
                </p>
                {preview.summary.eligibleContactCount === 0 && (
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--od-warning)', lineHeight: 1.4 }}>
                    {t.zeroEligibleHint}
                  </p>
                )}
              </div>

              {/* Blocked breakdown */}
              {preview.summary.blockedContactCount > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  {Object.entries(preview.blockedBreakdown)
                    .filter(([, count]) => count > 0)
                    .map(([reason, count]) => (
                      <span
                        key={reason}
                        className="od-count-chip"
                        style={{ fontSize: 10, color: BLOCKED_REASON_COLORS[reason] ?? 'var(--od-text-muted)' }}
                      >
                        {count} {(t as Record<string, string>)[reason] ?? reason}
                      </span>
                    ))}
                </div>
              )}

              {/* Exposure summary */}
              {(() => {
                const withExposure = preview.items.filter((it) => it.exposure_summary?.total_exposures > 0);
                if (withExposure.length === 0) return null;
                return (
                  <div style={{ marginBottom: 10 }}>
                    <span className="od-count-chip" style={{ fontSize: 10 }}>
                      {withExposure.length}/{preview.items.length} {language === 'ru' ? 'с историей касаний' : 'with prior exposure'}
                    </span>
                  </div>
                );
              })()}

              {/* Reused defaults */}
              {preview.defaults.senderPlanSummary.assignmentCount > 0 && (
                <div className="od-context-row">
                  <span className="od-context-row__label">{t.senders}</span>
                  <span className="od-context-row__value">
                    {preview.defaults.senderPlanSummary.assignmentCount} ({preview.defaults.senderPlanSummary.domains.join(', ')})
                  </span>
                </div>
              )}
              <div className="od-context-row">
                <span className="od-context-row__label">{t.sendPolicy}</span>
                <span className="od-context-row__value">
                  {preview.defaults.sendPolicy.sendTimezone} {preview.defaults.sendPolicy.sendWindowStartHour}:00–{preview.defaults.sendPolicy.sendWindowEndHour}:00
                </span>
              </div>

              {/* Name input */}
              <div style={{ marginTop: 12, marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--od-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>
                  {t.name}
                </label>
                <input
                  style={{
                    width: '100%',
                    fontSize: 13,
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--od-border)',
                    background: 'var(--od-card)',
                    color: 'var(--od-text)',
                  }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  disabled={creating}
                />
              </div>

              <button
                type="button"
                className="od-btn od-btn--approve"
                style={{ width: '100%', marginTop: 8 }}
                onClick={handleCreate}
                disabled={creating || !name.trim()}
              >
                {creating ? t.creating : t.create}
              </button>
            </>
          )}

          {/* Success step */}
          {step === 'success' && result && (
            <>
              <div style={{ marginBottom: 12 }}>
                <span
                  className="od-count-chip"
                  style={{
                    background: 'color-mix(in srgb, var(--od-success) 14%, transparent)',
                    color: 'var(--od-success)',
                    fontWeight: 600,
                  }}
                >
                  {t.success}
                </span>
              </div>

              <div className="od-context-row">
                <span className="od-context-row__label">{t.campaignId}</span>
                <span className="od-context-row__value" style={{ fontSize: 11, fontFamily: 'monospace' }}>
                  {result.campaign?.id ?? '—'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                <span className="od-count-chip" style={{ color: 'var(--od-success)' }}>
                  {result.summary.eligibleContactCount} {t.eligible.toLowerCase()}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button type="button" className="od-btn od-btn--ghost" onClick={handleClose}>
                  {t.done}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

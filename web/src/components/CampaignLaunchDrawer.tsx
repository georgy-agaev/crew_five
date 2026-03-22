import { useEffect, useState } from 'react';

import {
  campaignLaunch,
  campaignLaunchPreview,
  fetchIcpHypotheses,
  fetchOffers,
  fetchProjects,
  type CampaignLaunchPreviewResult,
  type CampaignLaunchResult,
  type MailboxRow,
  type OfferRecord,
  type ProjectRecord,
} from '../apiClient';
import { CampaignLaunchForm, type CampaignLaunchFormValues, type SendPolicyHint } from './CampaignLaunchForm';
import { CampaignLaunchPreviewCard } from './CampaignLaunchPreviewCard';

const translations: Record<string, Record<string, string>> = {
  en: {
    title: 'Launch campaign',
    back: 'Back',
    close: 'Close',
    launch: 'Launch',
    launching: 'Launching...',
    loading: 'Loading preview...',
    success: 'Campaign launched',
    campaignId: 'Campaign ID',
    senders: 'Sender assignments',
    goToCampaigns: 'Open in Campaigns',
  },
  ru: {
    title: 'Запуск кампании',
    back: 'Назад',
    close: 'Закрыть',
    launch: 'Запустить',
    launching: 'Запуск...',
    loading: 'Загрузка предпросмотра...',
    success: 'Кампания запущена',
    campaignId: 'ID кампании',
    senders: 'Отправители',
    goToCampaigns: 'Перейти в Кампании',
  },
};

function getT(language: string) {
  return translations[language] ?? translations['en'];
}

type Step = 'form' | 'preview' | 'success';

interface SegmentOption {
  id: string;
  name?: string | null;
}

export function CampaignLaunchDrawer({
  open,
  onClose,
  segments,
  mailboxes,
  initialSegmentId,
  sendPolicyHint,
  language = 'en',
  onLaunched,
}: {
  open: boolean;
  onClose: () => void;
  segments: SegmentOption[];
  mailboxes: MailboxRow[];
  initialSegmentId?: string;
  sendPolicyHint?: SendPolicyHint;
  language?: string;
  onLaunched?: (result: CampaignLaunchResult) => void;
}) {
  const t = getT(language);
  const [step, setStep] = useState<Step>('form');
  const [formValues, setFormValues] = useState<CampaignLaunchFormValues | null>(null);
  const [preview, setPreview] = useState<CampaignLaunchPreviewResult | null>(null);
  const [result, setResult] = useState<CampaignLaunchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [hypotheses, setHypotheses] = useState<any[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);

  useEffect(() => {
    if (!open) return;
    fetchOffers({ status: 'active' }).then(setOffers).catch(() => {});
    fetchIcpHypotheses().then((rows) => setHypotheses(rows as any[])).catch(() => {});
    fetchProjects({ status: 'active' }).then(setProjects).catch(() => {});
  }, [open]);

  const refreshOffers = () => {
    fetchOffers({ status: 'active' }).then(setOffers).catch(() => {});
  };
  const refreshProjects = () => {
    fetchProjects({ status: 'active' }).then(setProjects).catch(() => {});
  };

  const reset = () => {
    setStep('form');
    setFormValues(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePreview = async (values: CampaignLaunchFormValues) => {
    setFormValues(values);
    setError(null);
    setLoading(true);
    try {
      const res = await campaignLaunchPreview({
        name: values.name,
        segmentId: values.segmentId,
        segmentVersion: values.segmentVersion,
        snapshotMode: values.snapshotMode,
        offerId: values.offerId,
        icpHypothesisId: values.icpHypothesisId,
        senderPlan: values.senderAssignments.length > 0
          ? { assignments: values.senderAssignments }
          : undefined,
        sendTimezone: values.sendTimezone,
        sendWindowStartHour: values.sendWindowStartHour,
        sendWindowEndHour: values.sendWindowEndHour,
        sendWeekdaysOnly: values.sendWeekdaysOnly,
      });
      setPreview(res);
      setStep('preview');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLaunch = async () => {
    if (!formValues) return;
    setError(null);
    setLoading(true);
    try {
      const res = await campaignLaunch({
        name: formValues.name,
        segmentId: formValues.segmentId,
        segmentVersion: formValues.segmentVersion,
        snapshotMode: formValues.snapshotMode,
        projectId: formValues.projectId,
        offerId: formValues.offerId,
        icpHypothesisId: formValues.icpHypothesisId,
        createdBy: 'web-ui',
        senderPlan: formValues.senderAssignments.length > 0
          ? { source: 'web-launch', assignments: formValues.senderAssignments }
          : undefined,
        sendTimezone: formValues.sendTimezone,
        sendWindowStartHour: formValues.sendWindowStartHour,
        sendWindowEndHour: formValues.sendWindowEndHour,
        sendWeekdaysOnly: formValues.sendWeekdaysOnly,
      });
      setResult(res);
      setStep('success');
      onLaunched?.(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Launch failed');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="od-drawer-overlay od-drawer-overlay--open"
        onClick={handleClose}
      />

      {/* Drawer panel */}
      <div
        className="od-drawer od-drawer--open"
        style={{ maxWidth: 440, width: '100%' }}
      >
        {/* Header */}
        <div className="od-drawer__header">
          <h3 className="od-drawer__title">{t.title}</h3>
          <button className="od-drawer__close" onClick={handleClose}>
            {t.close}
          </button>
        </div>

        {/* Body */}
        <div className="od-drawer__body" style={{ padding: 16 }}>
          {error && (
            <div className="od-error-banner" role="alert" style={{ marginBottom: 12 }}>
              {error}
            </div>
          )}

          {/* Step: Form */}
          {step === 'form' && (
            <>
              {loading && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span className="od-skeleton" style={{ height: 14, width: '60%' }} />
                    <span className="od-skeleton" style={{ height: 12, width: '40%' }} />
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--od-text-muted)', marginTop: 8 }}>{t.loading}</p>
                </div>
              )}
              <CampaignLaunchForm
                segments={segments}
                mailboxes={mailboxes}
                offers={offers}
                projects={projects}
                hypotheses={hypotheses}
                initialSegmentId={initialSegmentId}
                sendPolicyHint={sendPolicyHint}
                language={language}
                disabled={loading}
                onPreview={handlePreview}
                onOffersRefresh={refreshOffers}
                onProjectsRefresh={refreshProjects}
              />
            </>
          )}

          {/* Step: Preview */}
          {step === 'preview' && preview && (
            <>
              <CampaignLaunchPreviewCard preview={preview} language={language} />

              {/* Offer in preview */}
              {formValues?.offerId && (() => {
                const offer = offers.find((o) => o.id === formValues.offerId);
                return offer ? (
                  <div className="od-context-row" style={{ marginTop: 8 }}>
                    <span className="od-context-row__label">{language === 'ru' ? 'Оффер' : 'Offer'}</span>
                    <span className="od-context-row__value">
                      {offer.title}
                      {offer.project_name && <span style={{ color: 'var(--od-text-muted)', fontSize: 11 }}> ({offer.project_name})</span>}
                    </span>
                  </div>
                ) : null;
              })()}

              {/* Hypothesis in preview */}
              {formValues?.icpHypothesisId && (() => {
                const hyp = hypotheses.find((h: any) => h.id === formValues.icpHypothesisId);
                return hyp ? (
                  <div className="od-context-row" style={{ marginTop: 4 }}>
                    <span className="od-context-row__label">{language === 'ru' ? 'Гипотеза' : 'Hypothesis'}</span>
                    <span className="od-context-row__value">
                      {hyp.hypothesis_label ?? hyp.id}
                      {hyp.messaging_angle && <span style={{ color: 'var(--od-text-muted)', fontSize: 11 }}> — {hyp.messaging_angle}</span>}
                    </span>
                  </div>
                ) : null;
              })()}

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  type="button"
                  className="od-btn od-btn--ghost"
                  onClick={() => { setStep('form'); setError(null); }}
                  disabled={loading}
                >
                  {t.back}
                </button>
                <button
                  type="button"
                  className="od-btn od-btn--approve"
                  style={{ flex: 1 }}
                  onClick={handleLaunch}
                  disabled={loading}
                >
                  {loading ? t.launching : t.launch}
                </button>
              </div>
            </>
          )}

          {/* Step: Success */}
          {step === 'success' && result && (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
              }}>
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

              {result.senderPlan?.summary && (
                <div className="od-context-row">
                  <span className="od-context-row__label">{t.senders}</span>
                  <span className="od-context-row__value">
                    {result.senderPlan.summary.assignmentCount} ({result.senderPlan.summary.domains?.join(', ') || '—'})
                  </span>
                </div>
              )}

              {result.sendPolicy && (
                <>
                  <div className="od-context-row">
                    <span className="od-context-row__label">{language === 'ru' ? 'Часовой пояс' : 'Timezone'}</span>
                    <span className="od-context-row__value">{result.sendPolicy.sendTimezone}</span>
                  </div>
                  <div className="od-context-row">
                    <span className="od-context-row__label">{language === 'ru' ? 'Окно' : 'Window'}</span>
                    <span className="od-context-row__value">{result.sendPolicy.sendWindowStartHour}:00 — {result.sendPolicy.sendWindowEndHour}:00</span>
                  </div>
                </>
              )}

              {/* Offer in success */}
              {formValues?.offerId && (() => {
                const offer = offers.find((o) => o.id === formValues.offerId);
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

              {/* Hypothesis in success */}
              {formValues?.icpHypothesisId && (() => {
                const hyp = hypotheses.find((h: any) => h.id === formValues.icpHypothesisId);
                return hyp ? (
                  <div className="od-context-row">
                    <span className="od-context-row__label">{language === 'ru' ? 'Гипотеза' : 'Hypothesis'}</span>
                    <span className="od-context-row__value">{hyp.hypothesis_label ?? hyp.id}</span>
                  </div>
                ) : null;
              })()}

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  type="button"
                  className="od-btn od-btn--ghost"
                  onClick={handleClose}
                >
                  {t.close}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

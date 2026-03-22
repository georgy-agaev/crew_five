import { useEffect, useState } from 'react';
import { fetchRotationPreview, type RotationPreviewResult } from '../apiClient';

const translations: Record<string, Record<string, string>> = {
  en: {
    title: 'Rotation preview',
    close: 'Close',
    loading: 'Loading...',
    source: 'Source campaign',
    currentOffer: 'Current offer',
    currentHypothesis: 'Current hypothesis',
    contacts: 'Source contacts',
    candidates: 'Rotation candidates',
    eligible: 'eligible',
    blocked: 'blocked',
    contactsHelp: 'Contacts already touched in the source wave.',
    candidatesHelp: 'Alternative hypothesis/offer combinations from the same ICP, excluding the current offer.',
    eligibleHelp: 'Contacts that can still receive this alternative offer right now.',
    blockedHelp: 'Contacts excluded because of reply-stop, suppression, cooldown, missing email, or prior exposure to that candidate offer.',
    zeroEligibleHint: 'No contacts are currently eligible for rotation from this source wave.',
    noCandidates: 'No rotation candidates found',
    offer: 'Offer',
    hypothesis: 'Hypothesis',
    angle: 'Angle',
    reply_received_stop: 'Reply (stop)',
    suppressed_contact: 'Suppressed',
    cooldown_active: 'Cooldown active',
    no_sendable_email: 'No email',
    already_received_candidate_offer: 'Already received offer',
  },
  ru: {
    title: 'Предпросмотр ротации',
    close: 'Закрыть',
    loading: 'Загрузка...',
    source: 'Исходная кампания',
    currentOffer: 'Текущий оффер',
    currentHypothesis: 'Текущая гипотеза',
    contacts: 'Контакты в источнике',
    candidates: 'Кандидаты на ротацию',
    eligible: 'доступно',
    blocked: 'заблокировано',
    contactsHelp: 'Контакты, которых уже касалась исходная волна.',
    candidatesHelp: 'Альтернативные связки гипотеза/оффер из того же ICP, кроме текущего оффера.',
    eligibleHelp: 'Контакты, которым можно отправить этот альтернативный оффер прямо сейчас.',
    blockedHelp: 'Контакты, исключённые из-за reply-stop, suppression, кулдауна, отсутствия email или предыдущего касания этим оффером.',
    zeroEligibleHint: 'Сейчас для ротации из этой исходной волны нет доступных контактов.',
    noCandidates: 'Кандидатов для ротации нет',
    offer: 'Оффер',
    hypothesis: 'Гипотеза',
    angle: 'Угол',
    reply_received_stop: 'Ответ (стоп)',
    suppressed_contact: 'Подавлено',
    cooldown_active: 'Кулдаун',
    no_sendable_email: 'Нет email',
    already_received_candidate_offer: 'Уже получал оффер',
  },
};

function getT(language: string) {
  return translations[language] ?? translations['en'];
}

const BLOCKED_COLORS: Record<string, string> = {
  reply_received_stop: 'var(--od-error)',
  suppressed_contact: 'var(--od-error)',
  cooldown_active: 'var(--od-warning)',
  no_sendable_email: 'var(--od-warning)',
  already_received_candidate_offer: 'var(--od-text-muted)',
};

export function CampaignRotationPreviewDrawer({
  open,
  campaignId,
  onClose,
  language = 'en',
}: {
  open: boolean;
  campaignId: string;
  onClose: () => void;
  language?: string;
}) {
  const t = getT(language);
  const [data, setData] = useState<RotationPreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !campaignId) return;
    let cancelled = false;
    setData(null);
    setError(null);
    setLoading(true);

    fetchRotationPreview(campaignId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err?.message ?? 'Failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [open, campaignId]);

  if (!open) return null;

  return (
    <>
      <div className="od-drawer-overlay od-drawer-overlay--open" onClick={onClose} />
      <div className="od-drawer od-drawer--open" style={{ maxWidth: 460, width: '100%' }}>
        <div className="od-drawer__header">
          <h3 className="od-drawer__title">{t.title}</h3>
          <button className="od-drawer__close" onClick={onClose}>{t.close}</button>
        </div>

        <div className="od-drawer__body" style={{ padding: 16 }}>
          {error && (
            <div className="od-error-banner" role="alert" style={{ marginBottom: 12 }}>{error}</div>
          )}

          {loading && !data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="od-skeleton" style={{ height: 14, width: '60%' }} />
              <span className="od-skeleton" style={{ height: 12, width: '45%' }} />
              <span className="od-skeleton" style={{ height: 12, width: '50%' }} />
              <p style={{ fontSize: 12, color: 'var(--od-text-muted)', marginTop: 4 }}>{t.loading}</p>
            </div>
          )}

          {data && (
            <>
              {/* Source campaign */}
              <div className="od-context-row">
                <span className="od-context-row__label">{t.source}</span>
                <span className="od-context-row__value">{data.sourceCampaign.campaignName}</span>
              </div>
              {data.sourceCampaign.offerTitle && (
                <div className="od-context-row">
                  <span className="od-context-row__label">{t.currentOffer}</span>
                  <span className="od-context-row__value">{data.sourceCampaign.offerTitle}</span>
                </div>
              )}
              {data.sourceCampaign.icpHypothesisLabel && (
                <div className="od-context-row">
                  <span className="od-context-row__label">{t.currentHypothesis}</span>
                  <span className="od-context-row__value">{data.sourceCampaign.icpHypothesisLabel}</span>
                </div>
              )}

              {/* Summary */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
                <span className="od-count-chip">{data.summary.sourceContactCount} {t.contacts.toLowerCase()}</span>
                <span className="od-count-chip">{data.summary.candidateCount} {t.candidates.toLowerCase()}</span>
                <span className="od-count-chip" style={{ color: data.summary.eligibleCandidateContactCount > 0 ? 'var(--od-success)' : 'var(--od-text-muted)' }}>
                  {data.summary.eligibleCandidateContactCount} {t.eligible}
                </span>
                {data.summary.blockedCandidateContactCount > 0 && (
                  <span className="od-count-chip" style={{ color: 'var(--od-warning)' }}>
                    {data.summary.blockedCandidateContactCount} {t.blocked}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--od-text-muted)', lineHeight: 1.4 }}>
                  <strong style={{ color: 'var(--od-text)' }}>{t.contacts}:</strong> {t.contactsHelp}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--od-text-muted)', lineHeight: 1.4 }}>
                  <strong style={{ color: 'var(--od-text)' }}>{t.candidates}:</strong> {t.candidatesHelp}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--od-text-muted)', lineHeight: 1.4 }}>
                  <strong style={{ color: 'var(--od-text)' }}>{t.eligible}:</strong> {t.eligibleHelp}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--od-text-muted)', lineHeight: 1.4 }}>
                  <strong style={{ color: 'var(--od-text)' }}>{t.blocked}:</strong> {t.blockedHelp}
                </p>
                {data.summary.eligibleCandidateContactCount === 0 && (
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--od-warning)', lineHeight: 1.4 }}>
                    {t.zeroEligibleHint}
                  </p>
                )}
              </div>

              {/* Candidates */}
              {data.candidates.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--od-text-muted)', padding: '12px 0' }}>
                  {t.noCandidates}
                </div>
              )}

              {data.candidates.map((cand, idx) => (
                <div
                  key={cand.icpHypothesisId}
                  style={{
                    padding: '8px 0',
                    borderTop: idx > 0 ? '1px solid var(--od-border)' : 'none',
                  }}
                >
                  {/* Candidate identity */}
                  {cand.offerTitle && (
                    <div style={{ fontSize: 12, color: 'var(--od-text)' }}>
                      <span style={{ fontSize: 10, color: 'var(--od-text-muted)', textTransform: 'uppercase' }}>{t.offer}: </span>
                      {cand.offerTitle}
                      {cand.projectName && <span style={{ color: 'var(--od-text-muted)', fontSize: 11 }}> ({cand.projectName})</span>}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--od-text)', marginTop: 2 }}>
                    <span style={{ fontSize: 10, color: 'var(--od-text-muted)', textTransform: 'uppercase' }}>{t.hypothesis}: </span>
                    {cand.hypothesisLabel ?? cand.icpHypothesisId.slice(0, 8)}
                  </div>
                  {cand.messagingAngle && (
                    <div style={{ fontSize: 11, color: 'var(--od-text-muted)', marginTop: 1 }}>
                      {t.angle}: {cand.messagingAngle}
                    </div>
                  )}

                  {/* Eligible / blocked */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                    <span className="od-count-chip" style={{ fontSize: 10, color: cand.eligibleContactCount > 0 ? 'var(--od-success)' : 'var(--od-text-muted)' }}>
                      {cand.eligibleContactCount} {t.eligible}
                    </span>
                    {cand.blockedContactCount > 0 && (
                      <span className="od-count-chip" style={{ fontSize: 10, color: 'var(--od-warning)' }}>
                        {cand.blockedContactCount} {t.blocked}
                      </span>
                    )}
                  </div>

                  {/* Blocked breakdown */}
                  {cand.blockedContactCount > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                      {Object.entries(cand.blockedBreakdown)
                        .filter(([, count]) => count > 0)
                        .map(([reason, count]) => (
                          <span
                            key={reason}
                            className="od-count-chip"
                            style={{ fontSize: 9, color: BLOCKED_COLORS[reason] ?? 'var(--od-text-muted)' }}
                          >
                            {count} {(t as Record<string, string>)[reason] ?? reason}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}

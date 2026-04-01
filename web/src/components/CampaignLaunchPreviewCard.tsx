import type { CampaignLaunchPreviewResult } from '../apiClient';

const translations: Record<string, Record<string, string>> = {
  en: {
    previewTitle: 'Launch preview',
    campaign: 'Campaign',
    segment: 'Segment',
    snapshot: 'Snapshot',
    companies: 'Companies',
    contacts: 'Contacts',
    sendable: 'Sendable',
    enrichment: 'Enrichment',
    fresh: 'fresh',
    stale: 'stale',
    missing: 'missing',
    senders: 'Senders',
    domains: 'Domains',
    noSender: 'No sender assigned',
    dayCountMode: 'Delay counting',
    elapsedDays: 'Elapsed days',
    businessDaysCampaign: 'Business days (campaign)',
    businessDaysRecipient: 'Business days (recipient)',
    calendarCountry: 'Calendar country',
    calendarSubdivision: 'Subdivision',
    warnings: 'Warnings',
  },
  ru: {
    previewTitle: 'Предпросмотр запуска',
    campaign: 'Кампания',
    segment: 'Сегмент',
    snapshot: 'Снимок',
    companies: 'Компании',
    contacts: 'Контакты',
    sendable: 'Отправляемые',
    enrichment: 'Обогащение',
    fresh: 'актуальных',
    stale: 'устаревших',
    missing: 'нет данных',
    senders: 'Отправители',
    domains: 'Домены',
    noSender: 'Отправитель не назначен',
    dayCountMode: 'Счёт дней',
    elapsedDays: 'Обычные дни',
    businessDaysCampaign: 'Рабочие дни кампании',
    businessDaysRecipient: 'Рабочие дни получателя',
    calendarCountry: 'Страна календаря',
    calendarSubdivision: 'Регион / штат',
    warnings: 'Предупреждения',
  },
};

function getT(language: string) {
  return translations[language] ?? translations['en'];
}

export function CampaignLaunchPreviewCard({
  preview,
  language = 'en',
}: {
  preview: CampaignLaunchPreviewResult;
  language?: string;
}) {
  const t = getT(language);
  const { campaign, segment, summary, senderPlan, warnings } = preview;

  return (
    <div>
      <h3 className="od-context-block__title" style={{ marginBottom: 10 }}>{t.previewTitle}</h3>

      {/* Campaign + segment info */}
      <div className="od-context-row">
        <span className="od-context-row__label">{t.campaign}</span>
        <span className="od-context-row__value">{campaign.name}</span>
      </div>
      <div className="od-context-row">
        <span className="od-context-row__label">{t.snapshot}</span>
        <span className="od-context-row__value">
          v{segment.version}{' '}
          <span style={{
            color: segment.snapshotStatus === 'existing' ? 'var(--od-success)' : 'var(--od-warning)',
            fontSize: 11,
          }}>
            ({segment.snapshotStatus})
          </span>
        </span>
      </div>

      {/* Counters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
        <span className="od-count-chip" title={t.companies}>{summary.companyCount} {t.companies.toLowerCase()}</span>
        <span className="od-count-chip" title={t.contacts}>{summary.contactCount} {t.contacts.toLowerCase()}</span>
        <span className="od-count-chip" title={t.sendable}
          style={{ color: summary.sendableContactCount > 0 ? 'var(--od-success)' : 'var(--od-warning)' }}
        >
          {summary.sendableContactCount} {t.sendable.toLowerCase()}
        </span>
      </div>

      {/* Enrichment summary */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {summary.freshCompanyCount > 0 && (
          <span className="od-count-chip" style={{ color: 'var(--od-success)' }}>
            {summary.freshCompanyCount} {t.fresh}
          </span>
        )}
        {summary.staleCompanyCount > 0 && (
          <span className="od-count-chip" style={{ color: 'var(--od-warning)' }}>
            {summary.staleCompanyCount} {t.stale}
          </span>
        )}
        {summary.missingCompanyCount > 0 && (
          <span className="od-count-chip" style={{ color: 'var(--od-error)' }}>
            {summary.missingCompanyCount} {t.missing}
          </span>
        )}
      </div>

      {/* Sender plan */}
      <div className="od-context-row">
        <span className="od-context-row__label">{t.senders}</span>
        <span className="od-context-row__value">
          {senderPlan.assignmentCount > 0
            ? `${senderPlan.assignmentCount} (${senderPlan.domainCount} domain${senderPlan.domainCount !== 1 ? 's' : ''})`
            : t.noSender}
        </span>
      </div>
      {senderPlan.domains.length > 0 && (
        <div className="od-context-row">
          <span className="od-context-row__label">{t.domains}</span>
          <span className="od-context-row__value">{senderPlan.domains.join(', ')}</span>
        </div>
      )}

      {/* Send policy */}
      {preview.sendPolicy && (
        <div style={{ marginTop: 8 }}>
          <div className="od-context-row">
            <span className="od-context-row__label">{language === 'ru' ? 'Часовой пояс' : 'Timezone'}</span>
            <span className="od-context-row__value">{preview.sendPolicy.sendTimezone}</span>
          </div>
          <div className="od-context-row">
            <span className="od-context-row__label">{language === 'ru' ? 'Окно отправки' : 'Send window'}</span>
            <span className="od-context-row__value">{preview.sendPolicy.sendWindowStartHour}:00 — {preview.sendPolicy.sendWindowEndHour}:00</span>
          </div>
          <div className="od-context-row">
            <span className="od-context-row__label">{language === 'ru' ? 'Только будни' : 'Weekdays only'}</span>
            <span className="od-context-row__value">{preview.sendPolicy.sendWeekdaysOnly ? (language === 'ru' ? 'Да' : 'Yes') : (language === 'ru' ? 'Нет' : 'No')}</span>
          </div>
          <div className="od-context-row">
            <span className="od-context-row__label">{t.dayCountMode}</span>
            <span className="od-context-row__value">
              {preview.sendPolicy.sendDayCountMode === 'business_days_campaign'
                ? t.businessDaysCampaign
                : preview.sendPolicy.sendDayCountMode === 'business_days_recipient'
                  ? t.businessDaysRecipient
                  : t.elapsedDays}
            </span>
          </div>
          {preview.sendPolicy.sendCalendarCountryCode && (
            <div className="od-context-row">
              <span className="od-context-row__label">{t.calendarCountry}</span>
              <span className="od-context-row__value">{preview.sendPolicy.sendCalendarCountryCode}</span>
            </div>
          )}
          {preview.sendPolicy.sendCalendarSubdivisionCode && (
            <div className="od-context-row">
              <span className="od-context-row__label">{t.calendarSubdivision}</span>
              <span className="od-context-row__value">{preview.sendPolicy.sendCalendarSubdivisionCode}</span>
            </div>
          )}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--od-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {t.warnings}
          </span>
          {warnings.map((w) => (
            <div
              key={w.code}
              style={{
                fontSize: 12,
                lineHeight: 1.6,
                color: 'var(--od-warning)',
                display: 'flex',
                gap: 6,
                alignItems: 'baseline',
                marginTop: 2,
              }}
            >
              <span style={{ flexShrink: 0 }}>&#x26A0;</span>
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

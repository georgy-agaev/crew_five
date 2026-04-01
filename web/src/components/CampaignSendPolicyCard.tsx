import { useCallback, useEffect, useState } from 'react';
import {
  fetchCampaignSendPolicy,
  updateCampaignSendPolicy,
  type CampaignSendPolicyView,
} from '../apiClient';

const translations: Record<string, Record<string, string>> = {
  en: {
    title: 'Send policy',
    timezone: 'Timezone',
    window: 'Send window',
    weekdaysOnly: 'Weekdays only',
    dayCountMode: 'Delay counting',
    elapsedDays: 'Elapsed days',
    businessDaysCampaign: 'Business days (campaign)',
    businessDaysRecipient: 'Business days (recipient)',
    calendarCountry: 'Calendar country',
    calendarSubdivision: 'Subdivision',
    yes: 'Yes',
    no: 'No',
    save: 'Save',
    saving: 'Saving...',
    updated: 'Last updated',
    selectCampaign: 'Select a campaign',
    invalidWindow: 'End hour must be greater than start hour',
    invalidHour: 'Hours must be integers (0-23 start, 1-24 end)',
    emptyTimezone: 'Timezone is required',
    emptyCountry: 'Country code is required for business-day mode',
  },
  ru: {
    title: 'Политика отправки',
    timezone: 'Часовой пояс',
    window: 'Окно отправки',
    weekdaysOnly: 'Только будни',
    dayCountMode: 'Счёт дней',
    elapsedDays: 'Обычные дни',
    businessDaysCampaign: 'Рабочие дни кампании',
    businessDaysRecipient: 'Рабочие дни получателя',
    calendarCountry: 'Страна календаря',
    calendarSubdivision: 'Регион / штат',
    yes: 'Да',
    no: 'Нет',
    save: 'Сохранить',
    saving: 'Сохранение...',
    updated: 'Обновлено',
    selectCampaign: 'Выберите кампанию',
    invalidWindow: 'Конец должен быть позже начала',
    invalidHour: 'Часы должны быть целыми числами (0-23 начало, 1-24 конец)',
    emptyTimezone: 'Укажите часовой пояс',
    emptyCountry: 'Для режима рабочих дней укажите код страны',
  },
};

function getT(language: string) {
  return translations[language] ?? translations['en'];
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function CampaignSendPolicyCard({
  campaignId,
  language = 'en',
}: {
  campaignId?: string;
  language?: string;
}) {
  const t = getT(language);
  const [data, setData] = useState<CampaignSendPolicyView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Local edit state
  const [timezone, setTimezone] = useState('Europe/Moscow');
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(17);
  const [weekdaysOnly, setWeekdaysOnly] = useState(true);
  const [dayCountMode, setDayCountMode] = useState<
    'elapsed_days' | 'business_days_campaign' | 'business_days_recipient'
  >('elapsed_days');
  const [calendarCountryCode, setCalendarCountryCode] = useState('');
  const [calendarSubdivisionCode, setCalendarSubdivisionCode] = useState('');

  const syncFromData = useCallback((view: CampaignSendPolicyView) => {
    setTimezone(view.sendTimezone);
    setStartHour(view.sendWindowStartHour);
    setEndHour(view.sendWindowEndHour);
    setWeekdaysOnly(view.sendWeekdaysOnly);
    setDayCountMode(view.sendDayCountMode);
    setCalendarCountryCode(view.sendCalendarCountryCode ?? '');
    setCalendarSubdivisionCode(view.sendCalendarSubdivisionCode ?? '');
  }, []);

  useEffect(() => {
    if (!campaignId) {
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchCampaignSendPolicy(campaignId)
      .then((view) => {
        if (!cancelled) {
          setData(view);
          syncFromData(view);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [campaignId, syncFromData]);

  const isDirty = data && (
    timezone !== data.sendTimezone ||
    startHour !== data.sendWindowStartHour ||
    endHour !== data.sendWindowEndHour ||
    weekdaysOnly !== data.sendWeekdaysOnly ||
    dayCountMode !== data.sendDayCountMode ||
    calendarCountryCode !== (data.sendCalendarCountryCode ?? '') ||
    calendarSubdivisionCode !== (data.sendCalendarSubdivisionCode ?? '')
  );

  const validate = (): string | null => {
    if (!timezone.trim()) return t.emptyTimezone;
    if (!Number.isInteger(startHour) || !Number.isInteger(endHour) || startHour < 0 || startHour > 23 || endHour < 1 || endHour > 24) {
      return t.invalidHour;
    }
    if (endHour <= startHour) return t.invalidWindow;
    if (
      (dayCountMode === 'business_days_campaign' || dayCountMode === 'business_days_recipient') &&
      !calendarCountryCode.trim()
    ) {
      return t.emptyCountry;
    }
    return null;
  };

  const handleSave = async () => {
    if (!campaignId || !isDirty) return;

    const err = validate();
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);

    setSaving(true);
    setError(null);
    try {
      const updated = await updateCampaignSendPolicy(campaignId, {
        sendTimezone: timezone,
        sendWindowStartHour: startHour,
        sendWindowEndHour: endHour,
        sendWeekdaysOnly: weekdaysOnly,
        sendDayCountMode: dayCountMode,
        sendCalendarCountryCode: calendarCountryCode.trim() || null,
        sendCalendarSubdivisionCode: calendarSubdivisionCode.trim() || null,
      });
      setData(updated);
      syncFromData(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ---- No campaign ----
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
          <span className="od-skeleton" style={{ height: 14, width: '55%' }} />
          <span className="od-skeleton" style={{ height: 12, width: '40%' }} />
        </div>
      </div>
    );
  }

  // ---- Error (no data) ----
  if (error && !data) {
    return (
      <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
        <h3 className="od-context-block__title">{t.title}</h3>
        <span style={{ fontSize: 12, color: 'var(--od-error)' }}>{error}</span>
      </div>
    );
  }

  if (!data) return null;

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '5px 0',
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--od-text)' };
  const inputStyle: React.CSSProperties = {
    fontSize: 12,
    padding: '3px 6px',
    borderRadius: 4,
    border: '1px solid var(--od-border)',
    background: 'var(--od-card)',
    color: 'var(--od-text)',
  };

  return (
    <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
      <h3 className="od-context-block__title">{t.title}</h3>

      {error && (
        <div style={{ fontSize: 12, color: 'var(--od-error)', marginBottom: 6 }}>{error}</div>
      )}

      {/* Timezone */}
      <div style={rowStyle}>
        <span style={labelStyle}>{t.timezone}</span>
        <input
          style={{ ...inputStyle, width: 140, textAlign: 'right' }}
          value={timezone}
          onChange={(e) => { setTimezone(e.target.value); setValidationError(null); }}
          disabled={saving}
        />
      </div>

      {/* Window */}
      <div style={rowStyle}>
        <span style={labelStyle}>{t.window}</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            type="number"
            min={0}
            max={23}
            style={{ ...inputStyle, width: 48, textAlign: 'center' }}
            value={startHour}
            onChange={(e) => { setStartHour(Number(e.target.value)); setValidationError(null); }}
            disabled={saving}
          />
          <span style={{ fontSize: 12, color: 'var(--od-text-muted)' }}>—</span>
          <input
            type="number"
            min={1}
            max={24}
            style={{ ...inputStyle, width: 48, textAlign: 'center' }}
            value={endHour}
            onChange={(e) => { setEndHour(Number(e.target.value)); setValidationError(null); }}
            disabled={saving}
          />
        </div>
      </div>

      {/* Weekdays only */}
      <div style={rowStyle}>
        <span style={labelStyle}>{t.weekdaysOnly}</span>
        <button
          type="button"
          className={`od-filter-chip${weekdaysOnly ? ' od-filter-chip--active' : ''}`}
          style={{ fontSize: 11 }}
          onClick={() => setWeekdaysOnly(!weekdaysOnly)}
          disabled={saving}
        >
          {weekdaysOnly ? t.yes : t.no}
        </button>
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>{t.dayCountMode}</span>
        <select
          style={{ ...inputStyle, width: 180, textAlign: 'right' }}
          value={dayCountMode}
          onChange={(e) => {
            setDayCountMode(
              e.target.value as 'elapsed_days' | 'business_days_campaign' | 'business_days_recipient'
            );
            setValidationError(null);
          }}
          disabled={saving}
        >
          <option value="elapsed_days">{t.elapsedDays}</option>
          <option value="business_days_campaign">{t.businessDaysCampaign}</option>
          <option value="business_days_recipient">{t.businessDaysRecipient}</option>
        </select>
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>{t.calendarCountry}</span>
        <input
          style={{ ...inputStyle, width: 90, textAlign: 'right', textTransform: 'uppercase' }}
          value={calendarCountryCode}
          onChange={(e) => { setCalendarCountryCode(e.target.value.toUpperCase()); setValidationError(null); }}
          disabled={saving}
          placeholder="RU"
        />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>{t.calendarSubdivision}</span>
        <input
          style={{ ...inputStyle, width: 140, textAlign: 'right' }}
          value={calendarSubdivisionCode}
          onChange={(e) => { setCalendarSubdivisionCode(e.target.value); setValidationError(null); }}
          disabled={saving}
          placeholder={language === 'ru' ? 'напр. MOW' : 'e.g. MOW'}
        />
      </div>

      {validationError && (
        <div style={{ fontSize: 11, color: 'var(--od-error)', marginTop: 2 }}>{validationError}</div>
      )}

      {/* Updated at */}
      {data.updatedAt && (
        <div className="od-context-row" style={{ marginTop: 4 }}>
          <span className="od-context-row__label">{t.updated}</span>
          <span className="od-context-row__value">{formatDate(data.updatedAt)}</span>
        </div>
      )}

      {/* Save */}
      {isDirty && (
        <button
          type="button"
          className="od-btn od-btn--approve"
          style={{ width: '100%', marginTop: 8, fontSize: 12 }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t.saving : t.save}
        </button>
      )}
    </div>
  );
}

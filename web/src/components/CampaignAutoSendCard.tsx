import { useCallback, useEffect, useState } from 'react';
import {
  fetchCampaignAutoSendSettings,
  updateCampaignAutoSendSettings,
  type CampaignAutoSendSettingsView,
} from '../apiClient';

const translations: Record<string, Record<string, string>> = {
  en: {
    title: 'Auto-send',
    intro: 'Intro auto-send',
    bump: 'Bump auto-send',
    bumpDelay: 'Bump delay (days)',
    enabled: 'Enabled',
    disabled: 'Disabled',
    save: 'Save',
    saving: 'Saving...',
    updated: 'Last updated',
    selectCampaign: 'Select a campaign',
    invalidDelay: 'Delay must be at least 1 day',
  },
  ru: {
    title: 'Автоотправка',
    intro: 'Автоотправка intro',
    bump: 'Автоотправка bump',
    bumpDelay: 'Задержка bump (дней)',
    enabled: 'Включено',
    disabled: 'Выключено',
    save: 'Сохранить',
    saving: 'Сохранение...',
    updated: 'Обновлено',
    selectCampaign: 'Выберите кампанию',
    invalidDelay: 'Задержка должна быть не менее 1 дня',
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

export function CampaignAutoSendCard({
  campaignId,
  language = 'en',
}: {
  campaignId?: string;
  language?: string;
}) {
  const t = getT(language);
  const [data, setData] = useState<CampaignAutoSendSettingsView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Local edit state
  const [introEnabled, setIntroEnabled] = useState(false);
  const [bumpEnabled, setBumpEnabled] = useState(false);
  const [bumpDelay, setBumpDelay] = useState(3);

  // Sync local state when data loads
  const syncFromData = useCallback((view: CampaignAutoSendSettingsView) => {
    setIntroEnabled(view.autoSendIntro);
    setBumpEnabled(view.autoSendBump);
    setBumpDelay(view.bumpMinDaysSinceIntro);
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

    fetchCampaignAutoSendSettings(campaignId)
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
    introEnabled !== data.autoSendIntro ||
    bumpEnabled !== data.autoSendBump ||
    bumpDelay !== data.bumpMinDaysSinceIntro
  );

  const handleSave = async () => {
    if (!campaignId || !isDirty) return;

    if (bumpDelay < 1 || !Number.isInteger(bumpDelay)) {
      setValidationError(t.invalidDelay);
      return;
    }
    setValidationError(null);

    setSaving(true);
    setError(null);
    try {
      const updated = await updateCampaignAutoSendSettings(campaignId, {
        autoSendIntro: introEnabled,
        autoSendBump: bumpEnabled,
        bumpMinDaysSinceIntro: bumpDelay,
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

  // ---- Error (no data at all) ----
  if (error && !data) {
    return (
      <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
        <h3 className="od-context-block__title">{t.title}</h3>
        <span style={{ fontSize: 12, color: 'var(--od-error)' }}>{error}</span>
      </div>
    );
  }

  if (!data) return null;

  const toggleStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 0',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--od-text)',
  };

  return (
    <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
      <h3 className="od-context-block__title">{t.title}</h3>

      {error && (
        <div style={{ fontSize: 12, color: 'var(--od-error)', marginBottom: 6 }}>{error}</div>
      )}

      {/* Intro toggle */}
      <div style={toggleStyle}>
        <span style={labelStyle}>{t.intro}</span>
        <button
          type="button"
          className={`od-filter-chip${introEnabled ? ' od-filter-chip--active' : ''}`}
          style={{ fontSize: 11 }}
          onClick={() => setIntroEnabled(!introEnabled)}
          disabled={saving}
        >
          {introEnabled ? t.enabled : t.disabled}
        </button>
      </div>

      {/* Bump toggle */}
      <div style={toggleStyle}>
        <span style={labelStyle}>{t.bump}</span>
        <button
          type="button"
          className={`od-filter-chip${bumpEnabled ? ' od-filter-chip--active' : ''}`}
          style={{ fontSize: 11 }}
          onClick={() => setBumpEnabled(!bumpEnabled)}
          disabled={saving}
        >
          {bumpEnabled ? t.enabled : t.disabled}
        </button>
      </div>

      {/* Bump delay */}
      <div style={{ ...toggleStyle, gap: 8 }}>
        <span style={labelStyle}>{t.bumpDelay}</span>
        <input
          type="number"
          min={1}
          step={1}
          value={bumpDelay}
          onChange={(e) => {
            setBumpDelay(Number(e.target.value));
            setValidationError(null);
          }}
          disabled={saving}
          style={{
            width: 60,
            fontSize: 12,
            padding: '4px 6px',
            borderRadius: 4,
            border: '1px solid var(--od-border)',
            background: 'var(--od-card)',
            color: 'var(--od-text)',
            textAlign: 'center',
          }}
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

      {/* Save button */}
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

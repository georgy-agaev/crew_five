import { useEffect, useState } from 'react';

import { loadSettings, saveSettings, validateSettings, type Settings } from '../hooks/useSettingsStore';
import { useTelemetry } from '../hooks/useTelemetry';

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [error, setError] = useState<string | null>(null);
  const telemetry = useTelemetry(settings.telemetry);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const onChange = (patch: Partial<Settings>) => {
    setError(null);
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const onSave = () => {
    try {
      validateSettings(settings);
      saveSettings(settings);
      telemetry('settings:update', { retryCapMs: settings.retryCapMs, assumeNow: settings.assumeNow });
    } catch (err: any) {
      setError(err?.message ?? 'Invalid settings');
    }
  };

  return (
    <section>
      <h2>Settings</h2>
      <div>
        <label>
          Retry cap (ms)
          <input
            type="number"
            value={settings.retryCapMs}
            onChange={(e) => onChange({ retryCapMs: Number(e.target.value) })}
            style={{ marginLeft: 8, width: 96 }}
          />
        </label>
      </div>
      <div style={{ marginTop: 8 }}>
        <label>
          Assume now
          <input
            type="checkbox"
            checked={settings.assumeNow}
            onChange={(e) => onChange({ assumeNow: e.target.checked })}
          />
          <small style={{ marginLeft: 8 }}>Use with caution; may reduce dedupe accuracy.</small>
        </label>
      </div>
      <div style={{ marginTop: 8 }}>
        <label>
          Telemetry opt-in
          <input
            type="checkbox"
            checked={settings.telemetry}
            onChange={(e) => onChange({ telemetry: e.target.checked })}
          />
          <small style={{ marginLeft: 8 }}>Avoid sending PII in payloads.</small>
        </label>
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={onSave}>Save</button>
      </div>
      {error && (
        <div style={{ marginTop: 8 }}>
          <strong>{error}</strong>
        </div>
      )}
    </section>
  );
}

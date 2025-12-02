import { useEffect, useState } from 'react';

import { loadSettings, saveSettings, validateSettings, type Settings } from '../hooks/useSettingsStore';
import { useTelemetry } from '../hooks/useTelemetry';
import { Alert } from '../components/Alert';

const modelOptions = [
  { provider: 'openai', model: 'gpt-4o', label: 'OpenAI gpt-4o (assistant)' },
  { provider: 'openai', model: 'gpt-4o-mini', label: 'OpenAI gpt-4o-mini (drafts/ICP/hypothesis)' },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', label: 'Anthropic Claude 3.5 Sonnet' },
  { provider: 'gemini', model: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
];

const tasks: Array<{ key: 'assistant' | 'icp' | 'hypothesis' | 'draft'; label: string }> = [
  { key: 'assistant', label: 'AI Assistant' },
  { key: 'icp', label: 'ICP Creation' },
  { key: 'hypothesis', label: 'Hypothesis Creation' },
  { key: 'draft', label: 'Message Draft' },
];

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
          <Alert kind="error">{error}</Alert>
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        <h3>Model Selection (per task)</h3>
        {tasks.map((task) => (
          <div key={task.key} style={{ marginBottom: 8 }}>
            <label>
              {task.label}
              <select
                style={{ marginLeft: 8, minWidth: 240 }}
                value={`${settings.providers[task.key].provider}:${settings.providers[task.key].model}`}
                onChange={(e) => {
                  const [provider, model] = e.target.value.split(':');
                  onChange({
                    providers: {
                      ...settings.providers,
                      [task.key]: { provider, model },
                    },
                  });
                }}
              >
                {modelOptions.map((opt) => (
                  <option key={`${opt.provider}:${opt.model}`} value={`${opt.provider}:${opt.model}`}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
        <small>Recommendations: use gpt-4o-mini for drafts/ICP/hypothesis; gpt-4o or Claude for assistant tasks.</small>
      </div>
    </section>
  );
}

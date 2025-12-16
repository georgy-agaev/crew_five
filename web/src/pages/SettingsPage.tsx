import { useEffect, useState } from 'react';

import { loadSettings, saveSettings, validateSettings, type Settings } from '../hooks/useSettingsStore';
import { useTelemetry } from '../hooks/useTelemetry';
import { Alert } from '../components/Alert';
import { getRecommendedModels, type ModelEntry } from '../../../src/config/modelCatalog';
import { fetchLlmModels } from '../apiClient';

const tasks: Array<{ key: 'assistant' | 'icp' | 'hypothesis' | 'draft'; label: string }> = [
  { key: 'assistant', label: 'AI Assistant' },
  { key: 'icp', label: 'ICP Creation' },
  { key: 'hypothesis', label: 'Hypothesis Creation' },
  { key: 'draft', label: 'Message Draft' },
];

const catalog: ModelEntry[] = getRecommendedModels();

function getTaskModels(
  task: 'assistant' | 'icp' | 'hypothesis' | 'draft',
  provider: string,
  llmModels: Record<string, string[] | undefined>
) {
  const live = llmModels[provider];
  if (live && live.length) {
    const unique = Array.from(new Set(live));
    return unique.map((id) => ({
      provider,
      model: id,
      tasks: [task],
      cost: 'medium',
      latency: 'medium',
      recommended: catalog.some((entry) => entry.provider === provider && entry.model === id && entry.recommended),
    }));
  }

  return catalog.filter((entry) => entry.provider === provider);
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [error, setError] = useState<string | null>(null);
  const [llmModels, setLlmModels] = useState<Record<string, string[] | undefined>>({});
  const telemetry = useTelemetry(settings.telemetry);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    const providers: Array<'openai' | 'anthropic'> = ['openai', 'anthropic'];
    providers.forEach((provider) => {
      if (llmModels[provider]) return;
      fetchLlmModels(provider)
        .then((models) => {
          const ids = (models ?? []).map((m) => m.id).filter(Boolean);
          setLlmModels((prev) => ({ ...prev, [provider]: ids }));
        })
        .catch(() => {
          // Swallow here; Settings will fall back to catalog entries.
        });
    });
  }, [llmModels]);

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
              {(() => {
                const current = settings.providers[task.key];
                const options = getTaskModels(task.key, current.provider, llmModels);
                const current = settings.providers[task.key];
                const currentKey = `${current.provider}:${current.model}`;
                const hasCurrent = options.some(
                  (opt) => `${opt.provider}:${opt.model}` === currentKey
                );
                const effective = hasCurrent
                  ? currentKey
                  : options.length
                  ? `${options[0].provider}:${options[0].model}`
                  : currentKey;
                if (!hasCurrent && options.length) {
                  const [provider, model] = effective.split(':');
                  settings.providers[task.key] = { provider, model };
                  saveSettings(settings);
                }
                return (
                  <select
                    style={{ marginLeft: 8, minWidth: 240 }}
                    value={effective}
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
                    {options.map((opt) => (
                      <option
                        key={`${opt.provider}:${opt.model}`}
                        value={`${opt.provider}:${opt.model}`}
                      >
                        {opt.provider}/{opt.model}
                      </option>
                    ))}
                  </select>
                );
              })()}
            </label>
          </div>
        ))}
        <small>Recommendations: use gpt-4o-mini for drafts/ICP/hypothesis; gpt-4o or Claude for assistant tasks.</small>
      </div>
    </section>
  );
}

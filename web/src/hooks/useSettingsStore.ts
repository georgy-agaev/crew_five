export type Settings = {
  retryCapMs: number;
  assumeNow: boolean;
  telemetry: boolean;
  providers: Record<'assistant' | 'icp' | 'hypothesis' | 'draft', { provider: string; model: string }>;
};

const defaultSettings: Settings = {
  retryCapMs: 5000,
  assumeNow: false,
  telemetry: false,
  providers: {
    assistant: { provider: 'openai', model: 'gpt-4o' },
    icp: { provider: 'openai', model: 'gpt-4o-mini' },
    hypothesis: { provider: 'openai', model: 'gpt-4o-mini' },
    draft: { provider: 'openai', model: 'gpt-4o-mini' },
  },
};

let memoryStore: Settings | null = null;

function getStorage() {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export function loadSettings(): Settings {
  if (memoryStore) return memoryStore;
  const storage = getStorage();
  if (!storage) return defaultSettings;
  const raw = storage.getItem('settings');
  if (!raw) return defaultSettings;
  try {
    const parsed = JSON.parse(raw) as Settings;
    memoryStore = { ...defaultSettings, ...parsed };
    return memoryStore;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: Settings) {
  memoryStore = settings;
  const storage = getStorage();
  if (storage) {
    storage.setItem('settings', JSON.stringify(settings));
  }
}

export function validateSettings(settings: Settings) {
  if (!Number.isInteger(settings.retryCapMs) || settings.retryCapMs <= 0) {
    throw new Error('retryCapMs must be a positive integer');
  }
  const tasks = ['assistant', 'icp', 'hypothesis', 'draft'] as const;
  for (const task of tasks) {
    const cfg = settings.providers[task];
    if (!cfg?.provider || !cfg?.model) {
      throw new Error(`Provider/model required for task ${task}`);
    }
  }
}

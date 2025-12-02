import { describe, expect, it } from 'vitest';

import { loadSettings, saveSettings, validateSettings, type Settings } from './useSettingsStore';

describe('useSettingsStore', () => {
  it('persists provider/model per task', () => {
    const settings = loadSettings();
    const updated: Settings = {
      ...settings,
      providers: {
        ...settings.providers,
        draft: { provider: 'anthropic', model: 'claude-3-5-sonnet' },
      },
    };
    saveSettings(updated);
    const loaded = loadSettings();
    expect(loaded.providers.draft.provider).toBe('anthropic');
    expect(loaded.providers.draft.model).toBe('claude-3-5-sonnet');
  });

  it('validates provider/model presence per task', () => {
    const settings = loadSettings();
    expect(() => validateSettings(settings)).not.toThrow();
    const broken = {
      ...settings,
      providers: { ...settings.providers, draft: { provider: '', model: '' } },
    };
    expect(() => validateSettings(broken as any)).toThrow(/Provider\/model required/);
  });
});

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

  it('persists taskPrompts mapping', () => {
    const settings = loadSettings();
    const updated: Settings = {
      ...settings,
      taskPrompts: {
        ...settings.taskPrompts,
        icpDiscovery: 'icp_prompt_v1',
        emailDraft: 'draft_prompt_v2',
      },
    };
    saveSettings(updated);
    const loaded = loadSettings();
    expect(loaded.taskPrompts?.icpDiscovery).toBe('icp_prompt_v1');
    expect(loaded.taskPrompts?.emailDraft).toBe('draft_prompt_v2');
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

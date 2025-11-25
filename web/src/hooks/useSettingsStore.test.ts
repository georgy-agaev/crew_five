import { describe, expect, it } from 'vitest';

import { loadSettings, saveSettings, validateSettings } from './useSettingsStore';

describe('useSettingsStore', () => {
  it('loads defaults when storage missing', () => {
    const settings = loadSettings();
    expect(settings.retryCapMs).toBe(5000);
    expect(settings.assumeNow).toBe(false);
  });

  it('saves and loads settings', () => {
    const next = { retryCapMs: 2000, assumeNow: true, telemetry: true };
    saveSettings(next);
    const loaded = loadSettings();
    expect(loaded.retryCapMs).toBe(2000);
    expect(loaded.assumeNow).toBe(true);
    expect(loaded.telemetry).toBe(true);
  });

  it('validates retry cap', () => {
    expect(() => validateSettings({ retryCapMs: -1, assumeNow: false, telemetry: false })).toThrow();
  });
});

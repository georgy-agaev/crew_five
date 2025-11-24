import { describe, expect, it } from 'vitest';

import { applyGracefulFallback, ensureGracefulToggle, getFallbackTemplate } from '../src/services/fallbackTemplates';

describe('fallbackTemplates', () => {
  it('fetches template', () => {
    const tpl = getFallbackTemplate('general', 'en');
    expect(tpl).toBeTruthy();
  });

  it('applies fallback on missing fields', () => {
    const tpl = 'Template Body';
    const result = applyGracefulFallback({ subject: null, body: null }, tpl);
    expect(result.subject).toBe('Fallback Subject');
    expect(result.body).toBe(tpl);
  });

  it('guardrails when catalog missing', () => {
    expect(() => ensureGracefulToggle(false)).toThrow(/fallback template catalog/);
  });
});

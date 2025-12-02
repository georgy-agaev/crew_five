import { describe, expect, it } from 'vitest';

import { assertSupportedModel, getRecommendedModels, resolveModelConfig } from '../src/config/modelCatalog';

describe('modelCatalog', () => {
  it('get_recommended_models_includes_expected_providers_and_models', () => {
    const models = getRecommendedModels();
    const key = models.map((m) => `${m.provider}/${m.model}`);
    expect(key).toContain('openai/gpt-4o-mini');
    expect(key).toContain('anthropic/claude-3-5-sonnet');
    expect(key).toContain('gemini/gemini-1.5-flash');
  });

  it('assert_supported_model_rejects_unknown_model', () => {
    expect(() => assertSupportedModel('openai', 'unknown-model')).toThrow();
  });

  it('resolve_model_config_returns_task_defaults_on_missing_flags', () => {
    const resolved = resolveModelConfig({ task: 'draft' });
    expect(resolved.provider).toBe('openai');
    expect(resolved.model).toBe('gpt-4o-mini');
  });

  it('resolve_model_config_accepts_explicit_provider_model', () => {
    const resolved = resolveModelConfig({ provider: 'anthropic', model: 'claude-3-5-sonnet', task: 'draft' });
    expect(resolved.provider).toBe('anthropic');
    expect(resolved.model).toBe('claude-3-5-sonnet');
  });
});

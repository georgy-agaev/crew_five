import { describe, expect, it } from 'vitest';

import { applyVariantToDraft, assignVariant } from '../src/services/experiments';

describe('experiments', () => {
  it('assigns_deterministically', () => {
    expect(assignVariant('subject1')).toBe(assignVariant('subject1'));
  });

  it('propagates_variant_label', () => {
    const draft = { metadata: { foo: 'bar' } };
    const result = applyVariantToDraft(draft, 'A');
    expect(result.metadata?.variant).toBe('A');
    expect(result.metadata?.foo).toBe('bar');
  });
});

import { describe, expect, it } from 'vitest';

import { useTelemetry } from './useTelemetry';

describe('useTelemetry', () => {
  it('emits when enabled', () => {
    const sink = (event: string, payload: Record<string, unknown>) => {
      expect(event).toBe('test');
      expect(payload.foo).toBe('bar');
    };
    const emit = useTelemetry(true, sink);
    emit('test', { foo: 'bar' });
  });

  it('rejects PII', () => {
    const emit = useTelemetry(true);
    expect(() => emit('test', { email: 'x' })).toThrow();
  });
});

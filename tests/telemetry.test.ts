import { describe, expect, it } from 'vitest';

import { emitTelemetry } from '../src/services/telemetry';

describe('telemetry', () => {
  it('emits_on_cli_actions_when_enabled', () => {
    const sink = (event: string, payload: Record<string, unknown>) => {
      expect(event).toBe('test:event');
      expect(payload.foo).toBe('bar');
    };
    emitTelemetry('test:event', { foo: 'bar' }, { enabled: true, sink });
  });

  it('rejects_invalid_payload', () => {
    expect(() => emitTelemetry('test', { email: 'x' }, { enabled: true })).toThrow();
  });
});

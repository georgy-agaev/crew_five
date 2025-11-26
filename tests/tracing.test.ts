import { describe, expect, it, vi } from 'vitest';

import { emitTrace, finishTrace, isTracingEnabled, startTrace } from '../src/services/tracing';

describe('tracing', () => {
  it('records_model_and_latency', () => {
    const trace = startTrace({ span: 'test', service: 'unit', model: 'm1' });
    const record = finishTrace(trace, 'ok');
    expect(record.trace_id).toBeTruthy();
    expect(record.latency_ms).toBeGreaterThanOrEqual(0);
    expect(record.status).toBe('ok');
  });

  it('emits_trace_to_file_or_console', () => {
    process.env.TRACE_ENABLED = 'true';
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const trace = startTrace({ span: 'test', service: 'unit' });
    emitTrace(finishTrace(trace, 'ok'), process.env);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    process.env.TRACE_ENABLED = 'false';
  });

  it('respects_env_toggle', () => {
    process.env.TRACE_ENABLED = 'false';
    expect(isTracingEnabled()).toBe(false);
  });
});

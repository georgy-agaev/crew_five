import { describe, expect, it, vi } from 'vitest';

import { buildSmartleadMcpClient } from '../src/integrations/smartleadMcp';

describe('smartlead MCP client', () => {
  it('client_calls_endpoints_with_auth', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ campaigns: [{ id: 'c1', name: 'Test' }] }),
    });

    const client = buildSmartleadMcpClient({
      url: 'http://smartlead.local',
      token: 'token-123',
      workspaceId: 'ws-1',
      fetchImpl: fetchMock as any,
    });

    await client.listCampaigns({});

    expect(fetchMock).toHaveBeenCalledWith('http://smartlead.local/campaigns', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer token-123',
        'Content-Type': 'application/json',
        'X-Workspace-Id': 'ws-1',
      },
    });
  });

  it('dry_run_skips_remote_calls', async () => {
    const fetchMock = vi.fn();
    const client = buildSmartleadMcpClient({
      url: 'http://smartlead.local',
      token: 'token-123',
      fetchImpl: fetchMock as any,
    });

    const result = await client.listCampaigns({ dryRun: true });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.dryRun).toBe(true);
  });

  it('pull_events_normalizes_for_ingest', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [
          {
            id: 'evt-1',
            type: 'delivered',
            contact_id: 'contact-1',
            outbound_id: 'out-1',
            occurred_at: '2025-01-01T00:00:00Z',
            outcome: 'meeting',
            raw: { hello: 'world' },
          },
        ],
      }),
    });

    const client = buildSmartleadMcpClient({
      url: 'http://smartlead.local',
      token: 'token-123',
      fetchImpl: fetchMock as any,
    });

    const result = await client.pullEvents({});

    expect(result.events[0]).toMatchObject({
      provider: 'smartlead',
      provider_event_id: 'evt-1',
      event_type: 'delivered',
      outcome_classification: 'meeting',
      contact_id: 'contact-1',
      outbound_id: 'out-1',
      occurred_at: '2025-01-01T00:00:00Z',
    });
    expect(result.events[0].payload?.raw).toEqual({ hello: 'world' });
  });

  it('pull_events_supports_since_and_limit', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ events: [] }),
    });

    const client = buildSmartleadMcpClient({
      url: 'http://smartlead.local',
      token: 'token-123',
      fetchImpl: fetchMock as any,
    });

    await client.pullEvents({ since: '2025-01-01T00:00:00Z', limit: 50 });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://smartlead.local/events?since=2025-01-01T00%3A00%3A00Z&limit=50',
      expect.any(Object)
    );
  });

  it('normalizes_idempotent_events', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [
          { type: 'delivered', id: 'evt-1', occurred_at: '2025-02-01T00:00:00Z' },
          { type: 'opened', occurred_at: '2025-02-01T00:00:00Z' }, // no id, should get a generated idempotency key via fallback
        ],
      }),
    });

    const client = buildSmartleadMcpClient({
      url: 'http://smartlead.local',
      token: 'token-123',
      fetchImpl: fetchMock as any,
    });

    const result = await client.pullEvents({});

    expect(result.events[0].provider_event_id).toBe('evt-1');
    expect(result.events[1].provider_event_id).not.toBeNull();
    expect(result.events[1].provider_event_id).toBeTypeOf('string');
  });

  it('idempotent_hash_for_missing_provider_id_is_stable', async () => {
    const event = { type: 'opened', occurred_at: '2025-02-01T00:00:00Z', outbound_id: 'out-1' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ events: [event, event] }),
    });
    const client = buildSmartleadMcpClient({
      url: 'http://smartlead.local',
      token: 'token-123',
      fetchImpl: fetchMock as any,
    });

    const result = await client.pullEvents({});
    expect(result.events[0].provider_event_id).toBe(result.events[1].provider_event_id);
  });

  it('fetch_error_includes_status_and_body_once_on_4xx', async () => {
    const textSpy = vi.fn().mockResolvedValue('{"error":"boom"}');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: textSpy,
      headers: new Map(),
    });
    const client = buildSmartleadMcpClient({
      url: 'http://smartlead.local',
      token: 'token-123',
      fetchImpl: fetchMock as any,
    });

    await expect(client.pullEvents({})).rejects.toThrow(/400/);
    expect(textSpy).toHaveBeenCalledTimes(1);
  });

  it('retries_once_on_5xx_and_succeeds_with_single_body_read', async () => {
    const textSpy = vi.fn().mockResolvedValue('fail');
    const first = {
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      text: textSpy,
      headers: new Map([['Retry-After', '5']]),
    } as any;
    const second = {
      ok: true,
      json: async () => ({ events: [] }),
      headers: new Map(),
    } as any;
    const fetchMock = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    const client = buildSmartleadMcpClient({
      url: 'http://smartlead.local',
      token: 'token-123',
      fetchImpl: fetchMock as any,
    });

    await client.pullEvents({ retryAfterCapMs: 10 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(textSpy).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10);
    expect('_cachedError' in first).toBe(false);
    setTimeoutSpy.mockRestore();
  });

  it('missing_occurred_at_flag_fills_now_or_errors', async () => {
    const now = new Date('2025-02-01T00:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [{ type: 'opened' }],
      }),
      headers: new Map(),
    });
    const client = buildSmartleadMcpClient({
      url: 'http://smartlead.local',
      token: 'token-123',
      fetchImpl: fetchMock as any,
    });

    await expect(client.pullEvents({})).rejects.toThrow(/occurred_at/);

    const result = await client.pullEvents({ assumeNowOccurredAt: true });
    expect(result.events[0].occurred_at).toBe(now.toISOString());
    vi.useRealTimers();
  });

  it('assume_now_uses_single_pull_timestamp', async () => {
    const now = new Date('2025-03-01T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [{ type: 'opened' }, { type: 'clicked' }],
      }),
      headers: new Map(),
    });
    const client = buildSmartleadMcpClient({
      url: 'http://smartlead.local',
      token: 'token-123',
      fetchImpl: fetchMock as any,
    });

    const result = await client.pullEvents({ assumeNowOccurredAt: true });
    expect(result.events[0].occurred_at).toBe(now.toISOString());
    expect(result.events[1].occurred_at).toBe(now.toISOString());
    vi.useRealTimers();
  });

  it('retry_cap_uses_default_when_not_overridden', async () => {
    const textSpy = vi.fn().mockResolvedValue('fail');
    const first = {
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      text: textSpy,
      headers: { get: (k: string) => (k === 'Retry-After' ? '10' : null) },
    } as any;
    const second = {
      ok: true,
      json: async () => ({ events: [] }),
      headers: { get: () => null },
    } as any;
    const fetchMock = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation((fn: any, _ms?: number) => {
      fn();
      return 0 as any;
    });

    const client = buildSmartleadMcpClient({
      url: 'http://smartlead.local',
      token: 'token-123',
      fetchImpl: fetchMock as any,
    });

    await client.pullEvents({});
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
    setTimeoutSpy.mockRestore();
  });

  it('error_body_snippet_is_capped', async () => {
    const longBody = 'a'.repeat(600);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      text: async () => longBody,
      headers: { get: () => null },
    });
    const client = buildSmartleadMcpClient({
      url: 'http://smartlead.local',
      token: 'token-123',
      fetchImpl: fetchMock as any,
    });

    await expect(client.pullEvents({})).rejects.toThrow(/truncated/);
    await expect(client.pullEvents({})).rejects.not.toThrow(longBody);
  });

  it('assume_now_emits_log_when_enabled', async () => {
    const now = new Date('2025-04-01T00:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [{ type: 'opened' }, { type: 'clicked' }],
      }),
      headers: new Map(),
    });
    const logSpy = vi.fn();
    const client = buildSmartleadMcpClient({
      url: 'http://smartlead.local',
      token: 'token-123',
      fetchImpl: fetchMock as any,
    });

    await client.pullEvents({ assumeNowOccurredAt: true, onAssumeNow: logSpy });
    expect(logSpy).toHaveBeenCalledWith({ count: 2 });
    vi.useRealTimers();
  });

  it('retry_cap_uses_env_override', async () => {
    const original = process.env.SMARTLEAD_MCP_RETRY_AFTER_CAP_MS;
    process.env.SMARTLEAD_MCP_RETRY_AFTER_CAP_MS = '200';
    const textSpy = vi.fn().mockResolvedValue('fail');
    const first = {
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      text: textSpy,
      headers: { get: (k: string) => (k === 'Retry-After' ? '10' : null) },
    } as any;
    const second = {
      ok: true,
      json: async () => ({ events: [] }),
      headers: { get: () => null },
    } as any;
    const fetchMock = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation((fn: any, _ms?: number) => {
      fn();
      return 0 as any;
    });

    const client = buildSmartleadMcpClient({
      url: 'http://smartlead.local',
      token: 'token-123',
      fetchImpl: fetchMock as any,
    });

    await client.pullEvents({});
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 200);
    setTimeoutSpy.mockRestore();
    process.env.SMARTLEAD_MCP_RETRY_AFTER_CAP_MS = original;
  });

  it('emits_trace_on_pull_when_enabled', async () => {
    process.env.TRACE_ENABLED = 'true';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ events: [] }),
    });
    const client = buildSmartleadMcpClient({
      url: 'http://smartlead.local',
      token: 'token-123',
      fetchImpl: fetchMock as any,
    });
    await client.pullEvents({});
    process.env.TRACE_ENABLED = 'false';
  });
});

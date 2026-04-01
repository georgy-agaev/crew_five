import { describe, expect, it, vi } from 'vitest';

import { classifyReply, ingestEmailEvent, mapProviderEvent } from './emailEvents.js';

describe('emailEvents', () => {
  it('maps provider events to schema-compatible email_events rows', () => {
    const result = mapProviderEvent({
      provider: 'imap_mcp',
      provider_event_id: 'evt-1',
      event_type: ' reply ',
      outcome_classification: 'soft_interest',
      contact_id: 'employee-1',
      outbound_id: 'outbound-1',
      payload: { reply_text: 'Interested' },
    });

    expect(result.provider).toBe('imap_mcp');
    expect(result.provider_event_id).toBe('evt-1');
    expect(result.event_type).toBe('replied');
    expect(result.reply_label).toBe('positive');
    expect(result.employee_id).toBe('employee-1');
    expect(result.outbound_id).toBe('outbound-1');
    expect(result.idempotency_key).toMatch(/[a-f0-9]{64}/);
    expect('contact_id' in result).toBe(false);
  });

  it('rejects provider events with unsupported event_type values', () => {
    expect(() =>
      mapProviderEvent({
        provider: 'imap_mcp',
        provider_event_id: 'evt-2',
        event_type: 'reply_received',
        outbound_id: 'outbound-1',
      })
    ).toThrow(/unsupported email event_type/i);
  });

  it('classifies outcome-driven negative and positive replies', () => {
    expect(classifyReply('replied', 'meeting')).toBe('positive');
    expect(classifyReply('replied', 'decline')).toBe('negative');
    expect(classifyReply('bounced', null)).toBeNull();
  });

  it('materializes bounced work email without changing processing status', async () => {
    const employeeUpdate = vi.fn(async (field: string, value: string) => {
      expect(field).toBe('id');
      expect(value).toBe('employee-1');
      return { error: null };
    });
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'email_events') {
          const query = {
            eq: vi.fn(() => query),
            limit: vi.fn(async () => ({ data: [], error: null })),
          };
          return {
            select: vi.fn(() => query),
            insert: vi.fn((row: Record<string, unknown>) => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { id: 'evt-1', ...row }, error: null })),
              })),
            })),
          };
        }

        if (table === 'email_outbound') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    id: 'out-1',
                    draft_id: null,
                    campaign_id: null,
                    contact_id: 'employee-1',
                    metadata: { recipient_email: 'alice@acme.ai' },
                  },
                  error: null,
                })),
              })),
            })),
          };
        }

        if (table === 'employees') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    id: 'employee-1',
                    work_email: 'alice@acme.ai',
                    generic_email: 'info@acme.ai',
                    processing_status: 'completed',
                  },
                  error: null,
                })),
              })),
            })),
            update: vi.fn((patch: Record<string, unknown>) => {
              expect(patch).toEqual({ work_email_status: 'bounced', reply_bounce: true });
              expect('processing_status' in patch).toBe(false);
              return {
                eq: employeeUpdate,
              };
            }),
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await ingestEmailEvent(client, {
      provider: 'imap_mcp',
      event_type: 'bounced',
      outbound_id: 'out-1',
      contact_id: 'employee-1',
    });

    expect(result.inserted).toBe(1);
    expect(employeeUpdate).toHaveBeenCalledTimes(1);
  });

  it('materializes unsubscribe flag on employee for unsubscribe events', async () => {
    const employeeUpdate = vi.fn(async (field: string, value: string) => {
      expect(field).toBe('id');
      expect(value).toBe('employee-2');
      return { error: null };
    });
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'email_events') {
          const query = {
            eq: vi.fn(() => query),
            limit: vi.fn(async () => ({ data: [], error: null })),
          };
          return {
            select: vi.fn(() => query),
            insert: vi.fn((row: Record<string, unknown>) => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { id: 'evt-2', ...row }, error: null })),
              })),
            })),
          };
        }

        if (table === 'email_outbound') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    id: 'out-2',
                    draft_id: null,
                    campaign_id: null,
                    contact_id: 'employee-2',
                    metadata: { recipient_email: 'bob@acme.ai' },
                  },
                  error: null,
                })),
              })),
            })),
          };
        }

        if (table === 'employees') {
          return {
            update: vi.fn((patch: Record<string, unknown>) => {
              expect(patch).toEqual({ reply_unsubscribe: true });
              return {
                eq: employeeUpdate,
              };
            }),
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await ingestEmailEvent(client, {
      provider: 'imap_mcp',
      event_type: 'unsubscribed',
      outbound_id: 'out-2',
      contact_id: 'employee-2',
    });

    expect(result.inserted).toBe(1);
    expect(employeeUpdate).toHaveBeenCalledTimes(1);
  });
});

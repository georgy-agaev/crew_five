import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/emailOutboundRecorder.js', () => ({
  recordEmailOutbound: vi.fn(),
}));

vi.mock('../src/services/campaignFollowupCandidates.js', () => ({
  listCampaignFollowupCandidates: vi.fn(),
}));

vi.mock('../src/services/campaignSendPolicy.js', () => ({
  getCampaignSendPolicy: vi.fn(),
}));

vi.mock('date-holidays', () => {
  return {
    default: class MockHolidays {
      private countryCode: string;

      constructor(countryCode: string) {
        this.countryCode = countryCode;
      }

      isHoliday(date: Date) {
        const isoDate = date.toISOString().slice(0, 10);
        if (this.countryCode === 'RU' && isoDate === '2026-03-04') {
          return [{ date: isoDate, name: 'RU Holiday', type: 'public' }];
        }
        return [];
      }
    },
  };
});

const { recordEmailOutbound } = await import('../src/services/emailOutboundRecorder.js');
const { listCampaignFollowupCandidates } = await import('../src/services/campaignFollowupCandidates.js');
const { getCampaignSendPolicy } = await import('../src/services/campaignSendPolicy.js');

import { executeCampaignSendRun } from '../src/services/campaignSendExecution.js';

function createClient(input: {
  drafts?: any[];
  employees?: any[];
  companies?: any[];
  outbounds?: any[];
  events?: any[];
  mailboxAssignments?: any[];
}) {
  const draftStatusUpdates: Array<{ status: string; id: string }> = [];

  const assignmentsOrder = vi.fn().mockResolvedValue({
    data: input.mailboxAssignments ?? [],
    error: null,
  });
  const assignmentsEq = vi.fn().mockReturnValue({ order: assignmentsOrder });
  const assignmentsSelect = vi.fn().mockReturnValue({ eq: assignmentsEq });

  const draftsEq = vi.fn((field: string, value: string) => {
    if (field !== 'campaign_id') {
      throw new Error(`Unexpected drafts eq field ${field}`);
    }
    return Promise.resolve({
      data: (input.drafts ?? []).filter((row) => row.campaign_id === value),
      error: null,
    });
  });
  const draftsIn = vi.fn((field: string, values: string[]) => {
    if (field !== 'id') {
      throw new Error(`Unexpected drafts in field ${field}`);
    }
    const set = new Set(values);
    return Promise.resolve({
      data: (input.drafts ?? []).filter((row) => set.has(row.id)),
      error: null,
    });
  });
  const draftsSelect = vi.fn().mockReturnValue({ eq: draftsEq, in: draftsIn });
  const draftsUpdateEq = vi.fn((field: string, id: string) => {
    if (field !== 'id') {
      throw new Error(`Unexpected draft update field ${field}`);
    }
    const pending = (draftsUpdate as any).__pendingStatus as string;
    draftStatusUpdates.push({ status: pending, id });
    return Promise.resolve({ error: null });
  });
  const draftsUpdate = vi.fn((patch: { status: string }) => {
    (draftsUpdate as any).__pendingStatus = patch.status;
    return { eq: draftsUpdateEq };
  });

  const employeesIn = vi.fn().mockResolvedValue({
    data: input.employees ?? [],
    error: null,
  });
  const employeesSelect = vi.fn().mockReturnValue({ in: employeesIn });

  const companiesIn = vi.fn().mockResolvedValue({
    data: input.companies ?? [],
    error: null,
  });
  const companiesSelect = vi.fn().mockReturnValue({ in: companiesIn });

  const outboundsEq = vi.fn((field: string, value: string) => {
    if (field !== 'campaign_id') {
      throw new Error(`Unexpected outbounds eq field ${field}`);
    }
    return Promise.resolve({
      data: (input.outbounds ?? []).filter((row) => row.campaign_id === value),
      error: null,
    });
  });
  const outboundsIn = vi.fn((field: string, values: string[]) => {
    const set = new Set(values);
    return Promise.resolve({
      data: (input.outbounds ?? []).filter((row) => set.has(row[field])),
      error: null,
    });
  });
  const outboundsSelect = vi.fn().mockReturnValue({ eq: outboundsEq, in: outboundsIn });

  const eventsIn = vi.fn().mockResolvedValue({
    data: input.events ?? [],
    error: null,
  });
  const eventsSelect = vi.fn().mockReturnValue({ in: eventsIn });

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'campaign_mailbox_assignments') {
        return { select: assignmentsSelect };
      }
      if (table === 'drafts') {
        return { select: draftsSelect, update: draftsUpdate };
      }
      if (table === 'employees') {
        return { select: employeesSelect };
      }
      if (table === 'companies') {
        return { select: companiesSelect };
      }
      if (table === 'email_outbound') {
        return { select: outboundsSelect };
      }
      if (table === 'email_events') {
        return { select: eventsSelect };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  } as any;

  return {
    client,
    draftStatusUpdates,
  };
}

describe('executeCampaignSendRun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCampaignSendPolicy).mockResolvedValue({
      campaignId: 'camp-default',
      campaignName: 'Default Campaign',
      campaignStatus: 'sending',
      updatedAt: '2026-03-24T09:00:00Z',
      sendTimezone: 'Europe/Moscow',
      sendWindowStartHour: 9,
      sendWindowEndHour: 17,
      sendWeekdaysOnly: true,
      sendDayCountMode: 'elapsed_days',
      sendCalendarCountryCode: null,
      sendCalendarSubdivisionCode: null,
    } as any);
  });

  it('sends eligible approved intros with round-robin sender assignment', async () => {
    const { client, draftStatusUpdates } = createClient({
      mailboxAssignments: [
        {
          id: 'a-1',
          campaign_id: 'camp-1',
          mailbox_account_id: 'mbox-1',
          sender_identity: 'sales-1@example.com',
          provider: 'imap_mcp',
          source: 'manual',
          assigned_at: '2026-03-23T08:00:00Z',
          metadata: null,
        },
        {
          id: 'a-2',
          campaign_id: 'camp-1',
          mailbox_account_id: 'mbox-2',
          sender_identity: 'sales-2@example.com',
          provider: 'imap_mcp',
          source: 'manual',
          assigned_at: '2026-03-23T08:00:00Z',
          metadata: null,
        },
      ],
      drafts: [
        {
          id: 'draft-1',
          campaign_id: 'camp-1',
          contact_id: 'contact-1',
          company_id: 'company-1',
          email_type: 'intro',
          status: 'approved',
          subject: 'Hello 1',
          body: 'Body 1',
          metadata: { seq: 1 },
        },
        {
          id: 'draft-2',
          campaign_id: 'camp-1',
          contact_id: 'contact-2',
          company_id: 'company-2',
          email_type: 'intro',
          status: 'approved',
          subject: 'Hello 2',
          body: 'Body 2',
          metadata: { seq: 2 },
        },
      ],
      employees: [
        { id: 'contact-1', work_email: 'one@example.com', work_email_status: 'valid', generic_email: null, generic_email_status: null },
        { id: 'contact-2', work_email: 'two@example.com', work_email_status: 'valid', generic_email: null, generic_email_status: null },
      ],
      companies: [
        { id: 'company-1', country_code: 'RU' },
        { id: 'company-2', country_code: 'DE' },
      ],
      outbounds: [],
      events: [],
    });

    const transport = {
      send: vi
        .fn()
        .mockResolvedValueOnce({ provider: 'imap_mcp', providerMessageId: 'msg-1' })
        .mockResolvedValueOnce({ provider: 'imap_mcp', providerMessageId: 'msg-2' }),
    };

    const result = await executeCampaignSendRun(client, transport, {
      campaignId: 'camp-1',
      reason: 'auto_send_intro',
      now: new Date('2026-03-23T09:00:00Z'),
    });

    expect(transport.send).toHaveBeenCalledTimes(2);
    expect(transport.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        draftId: 'draft-1',
        senderIdentity: 'sales-1@example.com',
        mailboxAccountId: 'mbox-1',
        to: 'one@example.com',
      })
    );
    expect(transport.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        draftId: 'draft-2',
        senderIdentity: 'sales-2@example.com',
        mailboxAccountId: 'mbox-2',
        to: 'two@example.com',
      })
    );
    expect(vi.mocked(recordEmailOutbound)).toHaveBeenCalledTimes(2);
    expect(draftStatusUpdates).toEqual([]);
    expect(result).toMatchObject({
      campaignId: 'camp-1',
      reason: 'auto_send_intro',
      selectedCount: 2,
      sentCount: 2,
      failedCount: 0,
      skippedCount: 0,
    });
  });

  it('sends intros to multiple employees within the same company in one campaign', async () => {
    const { client } = createClient({
      mailboxAssignments: [
        {
          id: 'a-1',
          campaign_id: 'camp-1',
          mailbox_account_id: 'mbox-1',
          sender_identity: 'sales-1@example.com',
          provider: 'imap_mcp',
          source: 'manual',
          assigned_at: '2026-03-23T08:00:00Z',
          metadata: null,
        },
        {
          id: 'a-2',
          campaign_id: 'camp-1',
          mailbox_account_id: 'mbox-2',
          sender_identity: 'sales-2@example.com',
          provider: 'imap_mcp',
          source: 'manual',
          assigned_at: '2026-03-23T08:00:00Z',
          metadata: null,
        },
      ],
      drafts: [
        {
          id: 'draft-1',
          campaign_id: 'camp-1',
          contact_id: 'contact-1',
          company_id: 'company-1',
          email_type: 'intro',
          status: 'approved',
          subject: 'Hello 1',
          body: 'Body 1',
          metadata: { seq: 1 },
        },
        {
          id: 'draft-2',
          campaign_id: 'camp-1',
          contact_id: 'contact-2',
          company_id: 'company-1',
          email_type: 'intro',
          status: 'approved',
          subject: 'Hello 2',
          body: 'Body 2',
          metadata: { seq: 2 },
        },
      ],
      employees: [
        { id: 'contact-1', work_email: 'one@example.com', work_email_status: 'valid', generic_email: null, generic_email_status: null },
        { id: 'contact-2', work_email: 'two@example.com', work_email_status: 'valid', generic_email: null, generic_email_status: null },
      ],
      companies: [{ id: 'company-1', country_code: 'RU' }],
      outbounds: [],
      events: [],
    });

    const transport = {
      send: vi.fn().mockResolvedValue({ provider: 'imap_mcp', providerMessageId: 'msg-1' }),
    };

    const result = await executeCampaignSendRun(client, transport as any, {
      campaignId: 'camp-1',
      reason: 'auto_send_intro',
      now: new Date('2026-03-23T09:00:00Z'),
    });

    expect(transport.send).toHaveBeenCalledTimes(2);
    expect(result.sentCount).toBe(2);
    expect(result.failedCount).toBe(0);
  });

  it('still sends intro to another employee in the same company even if one intro was already sent', async () => {
    const { client } = createClient({
      mailboxAssignments: [
        {
          id: 'a-1',
          campaign_id: 'camp-1',
          mailbox_account_id: 'mbox-1',
          sender_identity: 'sales@example.com',
          provider: 'imap_mcp',
          source: 'manual',
          assigned_at: '2026-03-23T08:00:00Z',
          metadata: null,
        },
      ],
      drafts: [
        {
          id: 'draft-sent',
          campaign_id: 'camp-1',
          contact_id: 'contact-1',
          company_id: 'company-1',
          email_type: 'intro',
          status: 'sent',
          subject: 'Already sent',
          body: 'Body',
          metadata: {},
        },
        {
          id: 'draft-next',
          campaign_id: 'camp-1',
          contact_id: 'contact-2',
          company_id: 'company-1',
          email_type: 'intro',
          status: 'approved',
          subject: 'Hello 2',
          body: 'Body 2',
          metadata: {},
        },
      ],
      employees: [
        { id: 'contact-1', work_email: 'one@example.com', work_email_status: 'valid', generic_email: null, generic_email_status: null },
        { id: 'contact-2', work_email: 'two@example.com', work_email_status: 'valid', generic_email: null, generic_email_status: null },
      ],
      companies: [{ id: 'company-1', country_code: 'RU' }],
      outbounds: [
        {
          id: 'out-1',
          campaign_id: 'camp-1',
          contact_id: 'contact-1',
          company_id: 'company-1',
          draft_id: 'draft-sent',
          status: 'sent',
          sent_at: '2026-03-23T09:10:00Z',
        },
      ],
      events: [],
    });

    const transport = { send: vi.fn().mockResolvedValue({ provider: 'imap_mcp', providerMessageId: 'msg-1' }) };

    const result = await executeCampaignSendRun(client, transport as any, {
      campaignId: 'camp-1',
      reason: 'auto_send_intro',
      now: new Date('2026-03-24T09:00:00Z'),
    });

    expect(transport.send).toHaveBeenCalledTimes(1);
    expect(transport.send).toHaveBeenCalledWith(expect.objectContaining({ draftId: 'draft-next', to: 'two@example.com' }));
    expect(result.sentCount).toBe(1);
    expect(result.failedCount).toBe(0);
  });

  it('uses followup candidates to send only eligible approved bumps', async () => {
    const { client } = createClient({
      mailboxAssignments: [
        {
          id: 'a-1',
          campaign_id: 'camp-2',
          mailbox_account_id: 'mbox-1',
          sender_identity: 'sales@example.com',
          provider: 'imap_mcp',
          source: 'manual',
          assigned_at: '2026-03-23T08:00:00Z',
          metadata: null,
        },
      ],
      drafts: [
        {
          id: 'draft-bump-1',
          campaign_id: 'camp-2',
          contact_id: 'contact-1',
          company_id: 'company-1',
          email_type: 'bump',
          status: 'approved',
          subject: 'Bump 1',
          body: 'Body 1',
          metadata: null,
        },
        {
          id: 'draft-bump-2',
          campaign_id: 'camp-2',
          contact_id: 'contact-2',
          company_id: 'company-2',
          email_type: 'bump',
          status: 'approved',
          subject: 'Bump 2',
          body: 'Body 2',
          metadata: null,
        },
      ],
      employees: [
        { id: 'contact-1', work_email: 'one@example.com', work_email_status: 'valid', generic_email: null, generic_email_status: null },
        { id: 'contact-2', work_email: 'two@example.com', work_email_status: 'valid', generic_email: null, generic_email_status: null },
      ],
      companies: [
        { id: 'company-1', country_code: 'RU' },
        { id: 'company-2', country_code: 'DE' },
      ],
      outbounds: [],
      events: [],
    });

    vi.mocked(listCampaignFollowupCandidates).mockResolvedValue([
      {
        contact_id: 'contact-1',
        company_id: 'company-1',
        intro_sent: true,
        intro_sent_at: '2026-03-20T10:00:00Z',
        intro_sender_identity: 'sales@example.com',
        reply_received: false,
        bounce: false,
        unsubscribed: false,
        bump_draft_exists: true,
        bump_draft_approved: true,
        bump_sent: false,
        eligible: true,
        days_since_intro: 3,
        auto_reply: null,
      },
      {
        contact_id: 'contact-2',
        company_id: 'company-2',
        intro_sent: true,
        intro_sent_at: '2026-03-20T10:00:00Z',
        intro_sender_identity: 'sales@example.com',
        reply_received: true,
        bounce: false,
        unsubscribed: false,
        bump_draft_exists: true,
        bump_draft_approved: true,
        bump_sent: false,
        eligible: false,
        days_since_intro: 3,
        auto_reply: null,
      },
    ] as any);

    const transport = {
      send: vi.fn().mockResolvedValue({ provider: 'imap_mcp', providerMessageId: 'msg-bump-1' }),
    };

    const result = await executeCampaignSendRun(client, transport, {
      campaignId: 'camp-2',
      reason: 'auto_send_bump',
    });

    expect(listCampaignFollowupCandidates).toHaveBeenCalledWith(client, 'camp-2', {});
    expect(transport.send).toHaveBeenCalledTimes(1);
    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: 'draft-bump-1',
        to: 'one@example.com',
      })
    );
    expect(result).toMatchObject({
      selectedCount: 1,
      sentCount: 1,
      skippedCount: 0,
    });
  });

  it('applies batch limit to mixed intro and bump execution', async () => {
    const { client } = createClient({
      mailboxAssignments: [
        {
          id: 'a-1',
          campaign_id: 'camp-3',
          mailbox_account_id: 'mbox-1',
          sender_identity: 'sales@example.com',
          provider: 'imap_mcp',
          source: 'manual',
          assigned_at: '2026-03-23T08:00:00Z',
          metadata: null,
        },
      ],
      drafts: [
        {
          id: 'draft-1',
          campaign_id: 'camp-3',
          contact_id: 'contact-1',
          company_id: 'company-1',
          email_type: 'intro',
          status: 'approved',
          subject: 'Intro 1',
          body: 'Body 1',
          metadata: null,
        },
        {
          id: 'draft-2',
          campaign_id: 'camp-3',
          contact_id: 'contact-2',
          company_id: 'company-2',
          email_type: 'bump',
          status: 'approved',
          subject: 'Bump 2',
          body: 'Body 2',
          metadata: null,
        },
      ],
      employees: [
        { id: 'contact-1', work_email: 'one@example.com', work_email_status: 'valid', generic_email: null, generic_email_status: null },
        { id: 'contact-2', work_email: 'two@example.com', work_email_status: 'valid', generic_email: null, generic_email_status: null },
      ],
      companies: [
        { id: 'company-1', country_code: 'RU' },
        { id: 'company-2', country_code: 'DE' },
      ],
      outbounds: [],
      events: [],
    });

    vi.mocked(listCampaignFollowupCandidates).mockResolvedValue([
      {
        contact_id: 'contact-2',
        company_id: 'company-2',
        intro_sent: true,
        intro_sent_at: '2026-03-20T10:00:00Z',
        intro_sender_identity: 'sales@example.com',
        reply_received: false,
        bounce: false,
        unsubscribed: false,
        bump_draft_exists: true,
        bump_draft_approved: true,
        bump_sent: false,
        eligible: true,
        days_since_intro: 3,
        auto_reply: null,
      },
    ] as any);

    const transport = {
      send: vi.fn().mockResolvedValue({ provider: 'imap_mcp', providerMessageId: 'msg-1' }),
    };

    const result = await executeCampaignSendRun(client, transport, {
      campaignId: 'camp-3',
      reason: 'auto_send_mixed',
      batchLimit: 1,
    });

    expect(transport.send).toHaveBeenCalledTimes(1);
    expect(result.selectedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
  });

  it('records failed outbounds without mutating draft status on transport error', async () => {
    const { client, draftStatusUpdates } = createClient({
      mailboxAssignments: [
        {
          id: 'a-1',
          campaign_id: 'camp-4',
          mailbox_account_id: 'mbox-1',
          sender_identity: 'sales@example.com',
          provider: 'imap_mcp',
          source: 'manual',
          assigned_at: '2026-03-23T08:00:00Z',
          metadata: null,
        },
      ],
      drafts: [
        {
          id: 'draft-1',
          campaign_id: 'camp-4',
          contact_id: 'contact-1',
          company_id: 'company-1',
          email_type: 'intro',
          status: 'approved',
          subject: 'Intro 1',
          body: 'Body 1',
          metadata: null,
        },
      ],
      employees: [
        { id: 'contact-1', work_email: 'one@example.com', work_email_status: 'valid', generic_email: null, generic_email_status: null },
      ],
      companies: [{ id: 'company-1', country_code: 'RU' }],
      outbounds: [],
      events: [],
    });

    const transport = {
      send: vi.fn().mockRejectedValue(new Error('provider down')),
    };

    const result = await executeCampaignSendRun(client, transport, {
      campaignId: 'camp-4',
      reason: 'auto_send_intro',
    });

    expect(vi.mocked(recordEmailOutbound)).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        draftId: 'draft-1',
        status: 'failed',
        sentAt: expect.any(String),
        error: 'provider down',
      })
    );
    expect(draftStatusUpdates).toEqual([]);
    expect(result).toMatchObject({
      sentCount: 0,
      failedCount: 1,
    });
  });

  it('caps one run to one message per assigned mailbox even when the requested batch is larger', async () => {
    const { client } = createClient({
      mailboxAssignments: [
        {
          id: 'a-1',
          campaign_id: 'camp-cap',
          mailbox_account_id: 'mbox-1',
          sender_identity: 'sales-1@example.com',
          provider: 'imap_mcp',
          source: 'manual',
          assigned_at: '2026-03-23T08:00:00Z',
          metadata: null,
        },
        {
          id: 'a-2',
          campaign_id: 'camp-cap',
          mailbox_account_id: 'mbox-2',
          sender_identity: 'sales-2@example.com',
          provider: 'imap_mcp',
          source: 'manual',
          assigned_at: '2026-03-23T08:00:00Z',
          metadata: null,
        },
      ],
      drafts: [
        {
          id: 'draft-1',
          campaign_id: 'camp-cap',
          contact_id: 'contact-1',
          company_id: 'company-1',
          email_type: 'intro',
          status: 'approved',
          subject: 'Hello 1',
          body: 'Body 1',
          metadata: null,
        },
        {
          id: 'draft-2',
          campaign_id: 'camp-cap',
          contact_id: 'contact-2',
          company_id: 'company-2',
          email_type: 'intro',
          status: 'approved',
          subject: 'Hello 2',
          body: 'Body 2',
          metadata: null,
        },
        {
          id: 'draft-3',
          campaign_id: 'camp-cap',
          contact_id: 'contact-3',
          company_id: 'company-3',
          email_type: 'intro',
          status: 'approved',
          subject: 'Hello 3',
          body: 'Body 3',
          metadata: null,
        },
      ],
      employees: [
        { id: 'contact-1', work_email: 'one@example.com', work_email_status: 'valid', generic_email: null, generic_email_status: null },
        { id: 'contact-2', work_email: 'two@example.com', work_email_status: 'valid', generic_email: null, generic_email_status: null },
        { id: 'contact-3', work_email: 'three@example.com', work_email_status: 'valid', generic_email: null, generic_email_status: null },
      ],
      companies: [
        { id: 'company-1', country_code: 'RU' },
        { id: 'company-2', country_code: 'RU' },
        { id: 'company-3', country_code: 'RU' },
      ],
      outbounds: [],
      events: [],
    });

    const transport = {
      send: vi
        .fn()
        .mockResolvedValueOnce({ provider: 'imap_mcp', providerMessageId: 'msg-1' })
        .mockResolvedValueOnce({ provider: 'imap_mcp', providerMessageId: 'msg-2' }),
    };

    const result = await executeCampaignSendRun(client, transport, {
      campaignId: 'camp-cap',
      reason: 'auto_send_intro',
      batchLimit: 25,
      now: new Date('2026-03-23T09:00:00Z'),
    });

    expect(transport.send).toHaveBeenCalledTimes(2);
    expect(result.selectedCount).toBe(2);
    expect(result.sentCount).toBe(2);
    expect(result.skippedCount).toBe(1);
  });

  it('surfaces structured transport errors instead of generic send execution failures', async () => {
    const { client } = createClient({
      mailboxAssignments: [
        {
          id: 'a-1',
          campaign_id: 'camp-structured',
          mailbox_account_id: 'mbox-1',
          sender_identity: 'sales@example.com',
          provider: 'imap_mcp',
          source: 'manual',
          assigned_at: '2026-03-23T08:00:00Z',
          metadata: null,
        },
      ],
      drafts: [
        {
          id: 'draft-1',
          campaign_id: 'camp-structured',
          contact_id: 'contact-1',
          company_id: 'company-1',
          email_type: 'intro',
          status: 'approved',
          subject: 'Intro 1',
          body: 'Body 1',
          metadata: null,
        },
      ],
      employees: [
        { id: 'contact-1', work_email: 'one@example.com', work_email_status: 'valid', generic_email: null, generic_email_status: null },
      ],
      companies: [{ id: 'company-1', country_code: 'RU' }],
      outbounds: [],
      events: [],
    });

    const transport = {
      send: vi.fn().mockRejectedValue({ message: 'SMTP AUTH failed', code: 'EAUTH' }),
    };

    const result = await executeCampaignSendRun(client, transport, {
      campaignId: 'camp-structured',
      reason: 'auto_send_intro',
    });

    expect(vi.mocked(recordEmailOutbound)).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        draftId: 'draft-1',
        status: 'failed',
        error: 'SMTP AUTH failed | code=EAUTH',
      })
    );
    expect(result.results[0]?.error).toBe('SMTP AUTH failed | code=EAUTH');
  });

  it('skips recipient-calendar sends on recipient non-workdays', async () => {
    vi.mocked(getCampaignSendPolicy).mockResolvedValue({
      campaignId: 'camp-5',
      campaignName: 'Recipient Calendar Campaign',
      campaignStatus: 'sending',
      updatedAt: '2026-03-24T09:00:00Z',
      sendTimezone: 'Europe/Moscow',
      sendWindowStartHour: 9,
      sendWindowEndHour: 17,
      sendWeekdaysOnly: true,
      sendDayCountMode: 'business_days_recipient',
      sendCalendarCountryCode: 'DE',
      sendCalendarSubdivisionCode: null,
    } as any);

    const { client } = createClient({
      mailboxAssignments: [
        {
          id: 'a-1',
          campaign_id: 'camp-5',
          mailbox_account_id: 'mbox-1',
          sender_identity: 'sales@example.com',
          provider: 'imap_mcp',
          source: 'manual',
          assigned_at: '2026-03-23T08:00:00Z',
          metadata: null,
        },
      ],
      drafts: [
        {
          id: 'draft-1',
          campaign_id: 'camp-5',
          contact_id: 'contact-1',
          company_id: 'company-1',
          email_type: 'intro',
          status: 'approved',
          subject: 'Intro 1',
          body: 'Body 1',
          metadata: null,
        },
      ],
      employees: [
        { id: 'contact-1', work_email: 'one@example.com', work_email_status: 'valid', generic_email: null, generic_email_status: null },
      ],
      companies: [{ id: 'company-1', country_code: 'RU' }],
      outbounds: [],
      events: [],
    });

    const transport = {
      send: vi.fn(),
    };

    const result = await executeCampaignSendRun(client, transport as any, {
      campaignId: 'camp-5',
      reason: 'auto_send_intro',
      now: new Date('2026-03-04T10:00:00Z'),
    });

    expect(transport.send).not.toHaveBeenCalled();
    expect(result.selectedCount).toBe(0);
    expect(result.sentCount).toBe(0);
  });

  it('does not send intro when the contact already received an intro in another campaign', async () => {
    const { client } = createClient({
      mailboxAssignments: [
        {
          id: 'a-1',
          campaign_id: 'camp-2',
          mailbox_account_id: 'mbox-1',
          sender_identity: 'sales@example.com',
          provider: 'imap_mcp',
          source: 'manual',
          assigned_at: '2026-03-23T08:00:00Z',
          metadata: null,
        },
      ],
      drafts: [
        // Current campaign draft (should be blocked by contact-level guardrail).
        {
          id: 'draft-new',
          campaign_id: 'camp-2',
          contact_id: 'contact-1',
          company_id: 'company-1',
          email_type: 'intro',
          status: 'approved',
          subject: 'Hello again',
          body: 'Body',
          metadata: {},
        },
        // Previously sent intro draft in another campaign.
        {
          id: 'draft-old',
          campaign_id: 'camp-1',
          contact_id: 'contact-1',
          company_id: 'company-1',
          email_type: 'intro',
          status: 'sent',
          subject: 'Hello',
          body: 'Body',
          metadata: {},
        },
      ],
      employees: [
        { id: 'contact-1', work_email: 'new@example.com', work_email_status: 'valid', generic_email: null, generic_email_status: null },
      ],
      companies: [{ id: 'company-1', country_code: 'RU' }],
      outbounds: [
        {
          id: 'out-old',
          campaign_id: 'camp-1',
          contact_id: 'contact-1',
          company_id: 'company-1',
          draft_id: 'draft-old',
          status: 'sent',
        },
      ],
      events: [],
    });

    const transport = { send: vi.fn() };

    const result = await executeCampaignSendRun(client, transport as any, {
      campaignId: 'camp-2',
      reason: 'auto_send_intro',
      now: new Date('2026-03-23T09:00:00Z'),
    });

    expect(transport.send).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      selectedCount: 0,
      sentCount: 0,
      failedCount: 0,
    });
  });
});

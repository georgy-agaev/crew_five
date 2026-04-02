import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/campaignSendPreflight', () => ({
  getCampaignSendPreflight: vi.fn(),
}));

vi.mock('../src/services/campaignFollowupCandidates', () => ({
  listCampaignFollowupCandidates: vi.fn(),
}));

vi.mock('../src/services/campaignBumpAutoGeneration.js', () => ({
  runCampaignBumpAutoGeneration: vi.fn(),
}));

const { getCampaignSendPreflight } = await import('../src/services/campaignSendPreflight');
const { listCampaignFollowupCandidates } = await import('../src/services/campaignFollowupCandidates');
const { runCampaignBumpAutoGeneration } = await import('../src/services/campaignBumpAutoGeneration.js');

import { runCampaignAutoSendSweep } from '../src/services/campaignAutoSend';

function createCampaignListClient(rows: Array<Record<string, unknown>>) {
  const or = vi.fn().mockResolvedValue({ data: rows, error: null });
  const select = vi.fn().mockReturnValue({ or });
  return {
    from: vi.fn((table: string) => {
      if (table !== 'campaigns') {
        throw new Error(`Unexpected table ${table}`);
      }
      return { select };
    }),
  } as any;
}

describe('runCampaignAutoSendSweep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runCampaignBumpAutoGeneration).mockResolvedValue({
      triggered: false,
      candidateCount: 0,
      eligibleCount: 0,
      requestedContactCount: 0,
      requestedContactIds: [],
    } as any);
  });

  it('triggers intro auto-send only when send preflight passes', async () => {
    vi.mocked(getCampaignSendPreflight).mockResolvedValue({
      campaign: { id: 'camp-1', name: 'One', status: 'ready', segment_id: 'seg-1', segment_version: 1 },
      readyToSend: true,
      blockers: [],
      summary: {
        mailboxAssignmentCount: 1,
        draftCount: 4,
        approvedDraftCount: 4,
        generatedDraftCount: 0,
        rejectedDraftCount: 0,
        sentDraftCount: 0,
        sendableApprovedDraftCount: 4,
        approvedMissingRecipientEmailCount: 0,
      },
      senderPlan: {
        assignmentCount: 1,
        mailboxAccountCount: 1,
        senderIdentityCount: 1,
        domainCount: 1,
        domains: ['voicexpert.ru'],
      },
    } as any);

    const client = createCampaignListClient([
      {
        id: 'camp-1',
        name: 'One',
        status: 'ready',
        auto_send_intro: true,
        auto_send_bump: false,
        bump_min_days_since_intro: 3,
      },
    ]);
    const triggerSendCampaign = vi.fn().mockResolvedValue({ accepted: true, triggered: 4 });

    const result = await runCampaignAutoSendSweep(client, {
      triggerSendCampaign,
      batchLimit: 25,
      now: new Date('2026-03-23T07:00:00Z'),
    });

    expect(triggerSendCampaign).toHaveBeenCalledWith({
      campaignId: 'camp-1',
      reason: 'auto_send_intro',
      batchLimit: 25,
    });
    expect(result.summary).toEqual({
      checkedCount: 1,
      triggeredCount: 1,
      introTriggeredCount: 1,
      bumpTriggeredCount: 0,
      mixedTriggeredCount: 0,
      skippedCount: 0,
      errorCount: 0,
    });
  });

  it('skips intro auto-send when canonical preflight is blocked', async () => {
    vi.mocked(getCampaignSendPreflight).mockResolvedValue({
      campaign: { id: 'camp-2', name: 'Two', status: 'ready', segment_id: 'seg-2', segment_version: 1 },
      readyToSend: false,
      blockers: [{ code: 'no_sender_assignment', message: 'Assign at least one sender before sending' }],
      summary: {
        mailboxAssignmentCount: 0,
        draftCount: 4,
        approvedDraftCount: 4,
        generatedDraftCount: 0,
        rejectedDraftCount: 0,
        sentDraftCount: 0,
        sendableApprovedDraftCount: 4,
        approvedMissingRecipientEmailCount: 0,
      },
      senderPlan: {
        assignmentCount: 0,
        mailboxAccountCount: 0,
        senderIdentityCount: 0,
        domainCount: 0,
        domains: [],
      },
    } as any);

    const client = createCampaignListClient([
      {
        id: 'camp-2',
        name: 'Two',
        status: 'ready',
        auto_send_intro: true,
        auto_send_bump: false,
        bump_min_days_since_intro: 3,
      },
    ]);
    const triggerSendCampaign = vi.fn();

    const result = await runCampaignAutoSendSweep(client, {
      triggerSendCampaign,
      now: new Date('2026-03-23T07:00:00Z'),
    });

    expect(triggerSendCampaign).not.toHaveBeenCalled();
    expect(result.campaigns[0]).toMatchObject({
      campaignId: 'camp-2',
      triggered: false,
      intro: {
        shouldTrigger: false,
        blockers: ['no_sender_assignment'],
      },
    });
  });

  it('triggers bump auto-send using canonical follow-up candidates', async () => {
    vi.mocked(listCampaignFollowupCandidates).mockResolvedValue([
      {
        contact_id: 'contact-1',
        company_id: 'company-1',
        intro_sent: true,
        intro_sent_at: '2026-03-10T10:00:00Z',
        intro_sender_identity: 'sales@voicexpert.ru',
        reply_received: false,
        bounce: false,
        unsubscribed: false,
        bump_draft_exists: true,
        bump_draft_approved: true,
        bump_sent: false,
        eligible: true,
        days_since_intro: 6,
        auto_reply: null,
      },
    ] as any);

    const client = createCampaignListClient([
      {
        id: 'camp-3',
        name: 'Three',
        status: 'sending',
        auto_send_intro: false,
        auto_send_bump: true,
        bump_min_days_since_intro: 5,
      },
    ]);
    const triggerSendCampaign = vi.fn().mockResolvedValue({ accepted: true, triggered: 1 });

    const result = await runCampaignAutoSendSweep(client, {
      triggerSendCampaign,
      now: new Date('2026-03-23T12:00:00Z'),
    });

    expect(listCampaignFollowupCandidates).toHaveBeenCalledWith(client, 'camp-3', {
      minDaysSinceIntro: 5,
      now: new Date('2026-03-23T12:00:00Z'),
    });
    expect(triggerSendCampaign).toHaveBeenCalledWith({
      campaignId: 'camp-3',
      reason: 'auto_send_bump',
      batchLimit: undefined,
    });
    expect(result.summary.bumpTriggeredCount).toBe(1);
  });

  it('triggers bump auto-generation before send evaluation when configured', async () => {
    vi.mocked(runCampaignBumpAutoGeneration).mockResolvedValue({
      triggered: true,
      candidateCount: 3,
      eligibleCount: 1,
      requestedContactCount: 1,
      requestedContactIds: ['contact-gen-1'],
      triggerResult: { generated: 1, skipped: 0 },
    } as any);
    vi.mocked(listCampaignFollowupCandidates).mockResolvedValue([] as any);

    const client = createCampaignListClient([
      {
        id: 'camp-gen-1',
        name: 'Generator',
        status: 'sending',
        auto_send_intro: false,
        auto_send_bump: true,
        bump_min_days_since_intro: 4,
      },
    ]);
    const triggerGenerateBumps = vi.fn().mockResolvedValue({ generated: 1, skipped: 0 });
    const triggerSendCampaign = vi.fn();

    const result = await runCampaignAutoSendSweep(client, {
      triggerGenerateBumps,
      triggerSendCampaign,
      batchLimit: 10,
      now: new Date('2026-04-01T09:00:00Z'),
    });

    expect(runCampaignBumpAutoGeneration).toHaveBeenCalledWith(client, {
      campaignId: 'camp-gen-1',
      minDaysSinceIntro: 4,
      limit: 10,
      now: new Date('2026-04-01T09:00:00Z'),
      triggerGenerateBumps,
    });
    expect(triggerSendCampaign).not.toHaveBeenCalled();
    expect(result.campaigns[0]).toMatchObject({
      campaignId: 'camp-gen-1',
      generation: {
        triggered: true,
        requestedContactCount: 1,
        requestedContactIds: ['contact-gen-1'],
      },
    });
  });

  it('skips bump auto-send when no canonical candidates are eligible', async () => {
    vi.mocked(listCampaignFollowupCandidates).mockResolvedValue([
      {
        contact_id: 'contact-2',
        company_id: 'company-2',
        intro_sent: true,
        intro_sent_at: '2026-03-10T10:00:00Z',
        intro_sender_identity: 'sales@voicexpert.ru',
        reply_received: true,
        bounce: false,
        unsubscribed: false,
        bump_draft_exists: true,
        bump_draft_approved: true,
        bump_sent: false,
        eligible: false,
        days_since_intro: 6,
        auto_reply: null,
      },
    ] as any);

    const client = createCampaignListClient([
      {
        id: 'camp-4',
        name: 'Four',
        status: 'sending',
        auto_send_intro: false,
        auto_send_bump: true,
        bump_min_days_since_intro: 3,
      },
    ]);
    const triggerSendCampaign = vi.fn();

    const result = await runCampaignAutoSendSweep(client, {
      triggerSendCampaign,
      now: new Date('2026-03-23T12:00:00Z'),
    });

    expect(triggerSendCampaign).not.toHaveBeenCalled();
    expect(result.campaigns[0]).toMatchObject({
      campaignId: 'camp-4',
      triggered: false,
      bump: {
        shouldTrigger: false,
        eligibleCandidateCount: 0,
      },
    });
  });

  it('uses a single mixed trigger for campaigns with actionable intros and bumps', async () => {
    vi.mocked(getCampaignSendPreflight).mockResolvedValue({
      campaign: { id: 'camp-5', name: 'Five', status: 'sending', segment_id: 'seg-5', segment_version: 1 },
      readyToSend: true,
      blockers: [],
      summary: {
        mailboxAssignmentCount: 1,
        draftCount: 6,
        approvedDraftCount: 6,
        generatedDraftCount: 0,
        rejectedDraftCount: 0,
        sentDraftCount: 2,
        sendableApprovedDraftCount: 4,
        approvedMissingRecipientEmailCount: 0,
      },
      senderPlan: {
        assignmentCount: 1,
        mailboxAccountCount: 1,
        senderIdentityCount: 1,
        domainCount: 1,
        domains: ['voicexpert.ru'],
      },
    } as any);
    vi.mocked(listCampaignFollowupCandidates).mockResolvedValue([
      {
        contact_id: 'contact-5',
        company_id: 'company-5',
        intro_sent: true,
        intro_sent_at: '2026-03-10T10:00:00Z',
        intro_sender_identity: 'sales@voicexpert.ru',
        reply_received: false,
        bounce: false,
        unsubscribed: false,
        bump_draft_exists: true,
        bump_draft_approved: true,
        bump_sent: false,
        eligible: true,
        days_since_intro: 6,
        auto_reply: null,
      },
    ] as any);

    const client = createCampaignListClient([
      {
        id: 'camp-5',
        name: 'Five',
        status: 'sending',
        auto_send_intro: true,
        auto_send_bump: true,
        bump_min_days_since_intro: 3,
      },
    ]);
    const triggerSendCampaign = vi.fn().mockResolvedValue({ accepted: true, triggered: 5 });

    const result = await runCampaignAutoSendSweep(client, {
      triggerSendCampaign,
      now: new Date('2026-03-23T12:00:00Z'),
    });

    expect(triggerSendCampaign).toHaveBeenCalledTimes(1);
    expect(triggerSendCampaign).toHaveBeenCalledWith({
      campaignId: 'camp-5',
      reason: 'auto_send_mixed',
      batchLimit: undefined,
    });
    expect(result.summary.mixedTriggeredCount).toBe(1);
  });

  it('continues sweep when one campaign trigger fails', async () => {
    vi.mocked(getCampaignSendPreflight)
      .mockResolvedValueOnce({
        campaign: { id: 'camp-6', name: 'Six', status: 'ready', segment_id: 'seg-6', segment_version: 1 },
        readyToSend: true,
        blockers: [],
        summary: {
          mailboxAssignmentCount: 1,
          draftCount: 1,
          approvedDraftCount: 1,
          generatedDraftCount: 0,
          rejectedDraftCount: 0,
          sentDraftCount: 0,
          sendableApprovedDraftCount: 1,
          approvedMissingRecipientEmailCount: 0,
        },
        senderPlan: {
          assignmentCount: 1,
          mailboxAccountCount: 1,
          senderIdentityCount: 1,
          domainCount: 1,
          domains: ['voicexpert.ru'],
        },
      } as any)
      .mockResolvedValueOnce({
        campaign: { id: 'camp-7', name: 'Seven', status: 'ready', segment_id: 'seg-7', segment_version: 1 },
        readyToSend: true,
        blockers: [],
        summary: {
          mailboxAssignmentCount: 1,
          draftCount: 1,
          approvedDraftCount: 1,
          generatedDraftCount: 0,
          rejectedDraftCount: 0,
          sentDraftCount: 0,
          sendableApprovedDraftCount: 1,
          approvedMissingRecipientEmailCount: 0,
        },
        senderPlan: {
          assignmentCount: 1,
          mailboxAccountCount: 1,
          senderIdentityCount: 1,
          domainCount: 1,
          domains: ['voicexpert.ru'],
        },
      } as any);

    const client = createCampaignListClient([
      {
        id: 'camp-6',
        name: 'Six',
        status: 'ready',
        auto_send_intro: true,
        auto_send_bump: false,
        bump_min_days_since_intro: 3,
      },
      {
        id: 'camp-7',
        name: 'Seven',
        status: 'ready',
        auto_send_intro: true,
        auto_send_bump: false,
        bump_min_days_since_intro: 3,
      },
    ]);
    const triggerSendCampaign = vi
      .fn()
      .mockRejectedValueOnce(new Error('trigger failed'))
      .mockResolvedValueOnce({ accepted: true, triggered: 1 });

    const result = await runCampaignAutoSendSweep(client, {
      triggerSendCampaign,
      now: new Date('2026-03-23T07:00:00Z'),
    });

    expect(triggerSendCampaign).toHaveBeenCalledTimes(2);
    expect(result.summary).toEqual({
      checkedCount: 2,
      triggeredCount: 1,
      introTriggeredCount: 1,
      bumpTriggeredCount: 0,
      mixedTriggeredCount: 0,
      skippedCount: 1,
      errorCount: 1,
    });
    expect(result.campaigns[0]).toMatchObject({
      campaignId: 'camp-6',
      error: 'trigger failed',
    });
    expect(result.campaigns[1]).toMatchObject({
      campaignId: 'camp-7',
      triggered: true,
    });
  });

  it('prefers the internal executor when provided', async () => {
    vi.mocked(getCampaignSendPreflight).mockResolvedValue({
      campaign: { id: 'camp-7b', name: 'Seven B', status: 'ready', segment_id: 'seg-7b', segment_version: 1 },
      readyToSend: true,
      blockers: [],
      summary: {
        mailboxAssignmentCount: 1,
        draftCount: 1,
        approvedDraftCount: 1,
        generatedDraftCount: 0,
        rejectedDraftCount: 0,
        sentDraftCount: 0,
        sendableApprovedDraftCount: 1,
        approvedMissingRecipientEmailCount: 0,
      },
      senderPlan: {
        assignmentCount: 1,
        mailboxAccountCount: 1,
        senderIdentityCount: 1,
        domainCount: 1,
        domains: ['voicexpert.ru'],
      },
    } as any);

    const client = createCampaignListClient([
      {
        id: 'camp-7b',
        name: 'Seven B',
        status: 'ready',
        auto_send_intro: true,
        auto_send_bump: false,
        bump_min_days_since_intro: 3,
      },
    ]);

    const executeSendCampaign = vi.fn().mockResolvedValue({ accepted: true, sentCount: 1 });
    const triggerSendCampaign = vi.fn();

    const result = await runCampaignAutoSendSweep(client, {
      executeSendCampaign,
      triggerSendCampaign,
      now: new Date('2026-03-23T07:00:00Z'),
    });

    expect(executeSendCampaign).toHaveBeenCalledWith({
      campaignId: 'camp-7b',
      reason: 'auto_send_intro',
      batchLimit: undefined,
    });
    expect(triggerSendCampaign).not.toHaveBeenCalled();
    expect(result.summary.triggeredCount).toBe(1);
  });

  it('runs bump generation outside campaign-local send window but keeps sending blocked', async () => {
    vi.mocked(runCampaignBumpAutoGeneration).mockResolvedValue({
      triggered: true,
      candidateCount: 5,
      eligibleCount: 2,
      requestedContactCount: 2,
      requestedContactIds: ['contact-bump-1', 'contact-bump-2'],
      triggerResult: { generated: 2, skipped: 0 },
    } as any);
    const client = createCampaignListClient([
      {
        id: 'camp-8',
        name: 'Eight',
        status: 'sending',
        auto_send_intro: true,
        auto_send_bump: true,
        bump_min_days_since_intro: 3,
        send_timezone: 'Europe/Moscow',
        send_window_start_hour: 9,
        send_window_end_hour: 17,
        send_weekdays_only: true,
      },
    ]);
    const triggerSendCampaign = vi.fn();

    const result = await runCampaignAutoSendSweep(client, {
      triggerSendCampaign,
      now: new Date('2026-03-23T14:30:00Z'),
    });

    expect(getCampaignSendPreflight).not.toHaveBeenCalled();
    expect(listCampaignFollowupCandidates).not.toHaveBeenCalled();
    expect(runCampaignBumpAutoGeneration).toHaveBeenCalledWith(client, {
      campaignId: 'camp-8',
      minDaysSinceIntro: 3,
      limit: undefined,
      now: new Date('2026-03-23T14:30:00Z'),
    });
    expect(triggerSendCampaign).not.toHaveBeenCalled();
    expect(result.campaigns[0]).toMatchObject({
      campaignId: 'camp-8',
      triggered: false,
      skipReason: 'calendar_outside_send_window',
      generation: {
        triggered: true,
        requestedContactCount: 2,
        requestedContactIds: ['contact-bump-1', 'contact-bump-2'],
      },
    });
  });

  it('skips auto-send on non-workdays before eligibility checks', async () => {
    const client = createCampaignListClient([
      {
        id: 'camp-9',
        name: 'Nine',
        status: 'sending',
        auto_send_intro: true,
        auto_send_bump: false,
        bump_min_days_since_intro: 3,
        send_timezone: 'Europe/Moscow',
        send_window_start_hour: 9,
        send_window_end_hour: 17,
        send_weekdays_only: true,
      },
    ]);
    const triggerSendCampaign = vi.fn();

    const result = await runCampaignAutoSendSweep(client, {
      triggerSendCampaign,
      now: new Date('2026-03-21T09:00:00Z'),
    });

    expect(getCampaignSendPreflight).not.toHaveBeenCalled();
    expect(triggerSendCampaign).not.toHaveBeenCalled();
    expect(result.campaigns[0]).toMatchObject({
      campaignId: 'camp-9',
      triggered: false,
      skipReason: 'calendar_non_workday',
    });
  });
});

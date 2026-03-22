import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/segments', () => ({
  getSegmentById: vi.fn(),
}));

vi.mock('../src/services/segmentSnapshotWorkflow', () => ({
  snapshotExists: vi.fn(),
}));

vi.mock('../src/services/filterPreview', () => ({
  getFilterPreviewCounts: vi.fn(),
}));

const { getSegmentById } = await import('../src/services/segments');
const { snapshotExists } = await import('../src/services/segmentSnapshotWorkflow');
const { getFilterPreviewCounts } = await import('../src/services/filterPreview');

import { getCampaignLaunchPreview } from '../src/services/campaignLaunchPreview';

describe('getCampaignLaunchPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds a preview from an existing snapshot with enrichment and sendability summary', async () => {
    vi.mocked(getSegmentById).mockResolvedValue({
      id: 'seg-1',
      version: 1,
      filter_definition: [{ field: 'employees.position', operator: 'contains', value: 'CEO' }],
    } as any);
    vi.mocked(snapshotExists).mockResolvedValue({ exists: true, count: 3 });

    const membersMatch = vi.fn().mockResolvedValue({
      data: [
        { company_id: 'comp-1', contact_id: 'contact-1' },
        { company_id: 'comp-1', contact_id: 'contact-2' },
        { company_id: 'comp-2', contact_id: 'contact-3' },
      ],
      error: null,
    });
    const membersSelect = vi.fn().mockReturnValue({ match: membersMatch });

    const companiesIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'comp-1',
          company_research: { providers: { firecrawl: {} }, lastUpdatedAt: '2026-03-19T10:00:00Z' },
          updated_at: '2026-03-19T10:00:00Z',
        },
        {
          id: 'comp-2',
          company_research: null,
          updated_at: '2026-01-01T10:00:00Z',
        },
      ],
      error: null,
    });
    const companiesSelect = vi.fn().mockReturnValue({ in: companiesIn });

    const employeesIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'contact-1',
          work_email: 'anna@alpha.ai',
          work_email_status: 'valid',
          generic_email: null,
          generic_email_status: null,
        },
        {
          id: 'contact-2',
          work_email: null,
          work_email_status: null,
          generic_email: 'info@alpha.ai',
          generic_email_status: 'valid',
        },
        {
          id: 'contact-3',
          work_email: null,
          work_email_status: null,
          generic_email: null,
          generic_email_status: null,
        },
      ],
      error: null,
    });
    const employeesSelect = vi.fn().mockReturnValue({ in: employeesIn });

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'segment_members') return { select: membersSelect };
        if (table === 'companies') return { select: companiesSelect };
        if (table === 'employees') return { select: employeesSelect };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const result = await getCampaignLaunchPreview(client, {
      name: 'Launch Q2',
      segmentId: 'seg-1',
      segmentVersion: 1,
      snapshotMode: 'reuse',
      sendTimezone: 'Europe/Berlin',
      sendWindowStartHour: 8,
      sendWindowEndHour: 16,
      sendWeekdaysOnly: true,
      senderPlan: {
        assignments: [
          {
            mailboxAccountId: 'mbox-1',
            senderIdentity: 'sales@voicexpertout.ru',
            provider: 'imap_mcp',
          },
        ],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.segment.snapshotStatus).toBe('existing');
    expect(result.summary).toEqual({
      companyCount: 2,
      contactCount: 3,
      sendableContactCount: 2,
      freshCompanyCount: 1,
      staleCompanyCount: 0,
      missingCompanyCount: 1,
      senderAssignmentCount: 1,
    });
    expect(result.senderPlan.domains).toEqual(['voicexpertout.ru']);
    expect(result.sendPolicy).toEqual({
      sendTimezone: 'Europe/Berlin',
      sendWindowStartHour: 8,
      sendWindowEndHour: 16,
      sendWeekdaysOnly: true,
    });
    expect(result.warnings.map((row) => row.code)).toEqual(['company_enrichment_incomplete']);
  });

  it('returns estimate-only preview when snapshot is missing in reuse mode', async () => {
    vi.mocked(getSegmentById).mockResolvedValue({
      id: 'seg-2',
      version: 1,
      filter_definition: [{ field: 'companies.employee_count', operator: 'gte', value: 30 }],
    } as any);
    vi.mocked(snapshotExists).mockResolvedValue({ exists: false, count: 0 });
    vi.mocked(getFilterPreviewCounts).mockResolvedValue({
      companyCount: 12,
      employeeCount: 19,
      totalCount: 19,
    });

    const client = { from: vi.fn() } as any;

    const result = await getCampaignLaunchPreview(client, {
      name: 'Estimate Launch',
      segmentId: 'seg-2',
      segmentVersion: 1,
      snapshotMode: 'reuse',
      senderPlan: { assignments: [] },
      sendTimezone: 'Europe/Berlin',
      sendWindowStartHour: 8,
      sendWindowEndHour: 16,
      sendWeekdaysOnly: true,
    });

    expect(result.segment.snapshotStatus).toBe('missing');
    expect(result.summary).toEqual({
      companyCount: 12,
      contactCount: 19,
      sendableContactCount: 0,
      freshCompanyCount: 0,
      staleCompanyCount: 0,
      missingCompanyCount: 0,
      senderAssignmentCount: 0,
    });
    expect(result.warnings.map((row) => row.code)).toEqual([
      'snapshot_missing_refresh_required',
      'missing_sender_plan',
    ]);
    expect(result.sendPolicy).toEqual({
      sendTimezone: 'Europe/Berlin',
      sendWindowStartHour: 8,
      sendWindowEndHour: 16,
      sendWeekdaysOnly: true,
    });
    expect(getFilterPreviewCounts).toHaveBeenCalledWith(client, [
      { field: 'companies.employee_count', operator: 'gte', value: 30 },
    ]);
  });
});

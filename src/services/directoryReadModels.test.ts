import { describe, expect, it, vi } from 'vitest';

import {
  listDirectoryCompanies,
  listDirectoryContacts,
} from './directoryReadModels';

describe('directory read models', () => {
  it('builds company directory rows with enrichment and contact stats', async () => {
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'companies') {
          return {
            select: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: [
                  {
                    id: 'co-1',
                    company_name: 'Acme AI',
                    segment: 'AI',
                    status: 'active',
                    website: 'https://acme.ai',
                    employee_count: 42,
                    office_qualification: 'More',
                    registration_date: '2024-01-10',
                    updated_at: '2026-03-10T10:00:00Z',
                    company_research: {
                      version: 1,
                      lastUpdatedAt: '2026-03-16T10:00:00Z',
                      providers: { firecrawl: {} },
                    },
                  },
                  {
                    id: 'co-2',
                    company_name: 'Beta Systems',
                    segment: 'Industrial',
                    status: 'pending',
                    website: null,
                    employee_count: 15,
                    office_qualification: null,
                    registration_date: null,
                    updated_at: '2026-01-01T10:00:00Z',
                    company_research: null,
                  },
                ],
                error: null,
              })),
            })),
          };
        }

        if (table === 'employees') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [
                  { company_id: 'co-1', work_email: 'ceo@acme.ai', generic_email: null },
                  { company_id: 'co-1', work_email: null, generic_email: 'hello@acme.ai' },
                  { company_id: 'co-2', work_email: null, generic_email: null },
                ],
                error: null,
              })),
            })),
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await listDirectoryCompanies(client, { query: 'acme' });

    expect(result.summary.total).toBe(1);
    expect(result.summary.enrichment).toEqual({ fresh: 1, stale: 0, missing: 0 });
    expect(result.items).toEqual([
      {
        companyId: 'co-1',
        companyName: 'Acme AI',
        segment: 'AI',
        status: 'active',
        website: 'https://acme.ai',
        employeeCount: 42,
        officeQualification: 'More',
        registrationDate: '2024-01-10',
        updatedAt: '2026-03-10T10:00:00Z',
        enrichment: {
          status: 'fresh',
          lastUpdatedAt: '2026-03-16T10:00:00.000Z',
          providerHint: 'firecrawl',
        },
        contacts: {
          total: 2,
          withWorkEmail: 1,
          withAnyEmail: 2,
          missingEmail: 0,
        },
        flags: {
          hasWebsite: true,
          hasResearch: true,
        },
      },
    ]);
  });

  it('builds contact directory rows with email and enrichment filters', async () => {
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'employees') {
          return {
            select: vi.fn(() => ({
              limit: vi.fn(async () => ({
                data: [
                  {
                    id: 'ct-1',
                    company_id: 'co-1',
                    company_name: 'Acme AI',
                    full_name: 'Alice Doe',
                    position: 'CTO',
                    work_email: 'alice@acme.ai',
                    work_email_status: 'bounced',
                    generic_email: null,
                    generic_email_status: 'unknown',
                    updated_at: '2026-03-16T11:00:00Z',
                    ai_research_data: {
                      version: 1,
                      lastUpdatedAt: '2026-03-16T12:00:00Z',
                      providers: { exa: {} },
                    },
                    processing_status: 'completed',
                  },
                  {
                    id: 'ct-2',
                    company_id: 'co-2',
                    company_name: 'Beta Systems',
                    full_name: 'Bob Roe',
                    position: 'COO',
                    work_email: null,
                    work_email_status: 'unknown',
                    generic_email: 'team@beta.test',
                    generic_email_status: 'valid',
                    updated_at: '2026-01-10T11:00:00Z',
                    ai_research_data: null,
                    processing_status: 'pending',
                  },
                ],
                error: null,
              })),
            })),
          };
        }

        if (table === 'companies') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [
                  { id: 'co-1', segment: 'AI', status: 'active' },
                  { id: 'co-2', segment: 'Industrial', status: 'pending' },
                ],
                error: null,
              })),
            })),
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await listDirectoryContacts(client, {
      segment: 'AI',
      emailStatus: 'work',
      enrichmentStatus: 'fresh',
      query: 'alice',
    });

    expect(result.summary.total).toBe(1);
    expect(result.summary.emailStatus).toEqual({ work: 1, generic: 0, missing: 0 });
    expect(result.items).toEqual([
      {
        contactId: 'ct-1',
        companyId: 'co-1',
        companyName: 'Acme AI',
        companySegment: 'AI',
        companyStatus: 'active',
        fullName: 'Alice Doe',
        position: 'CTO',
        workEmail: 'alice@acme.ai',
        genericEmail: null,
        emailStatus: 'work',
        workEmailStatus: 'bounced',
        genericEmailStatus: 'unknown',
        processingStatus: 'completed',
        updatedAt: '2026-03-16T11:00:00Z',
        enrichment: {
          status: 'fresh',
          lastUpdatedAt: '2026-03-16T12:00:00.000Z',
          providerHint: 'exa',
        },
      },
    ]);
  });

  it('applies companyIds filter at SQL level before limiting contact results', async () => {
    const inFilter = vi.fn(async (field: string, values: string[]) => {
      expect(field).toBe('company_id');
      expect(values).toEqual(['co-target']);
      return {
        data: [
          {
            id: 'ct-target',
            company_id: 'co-target',
            company_name: 'Target Co',
            full_name: 'Target Person',
            position: 'CEO',
            work_email: 'target@example.com',
            work_email_status: 'unknown',
            generic_email: null,
            generic_email_status: 'unknown',
            updated_at: '2026-03-18T10:00:00Z',
            ai_research_data: null,
            processing_status: 'completed',
          },
        ],
        error: null,
      };
    });
    const limit = vi.fn(async () => {
      throw new Error('limit() should not be used when companyIds are provided');
    });
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'employees') {
          return {
            select: vi.fn(() => ({
              in: inFilter,
              limit,
            })),
          };
        }

        if (table === 'companies') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [{ id: 'co-target', segment: 'AI', status: 'active' }],
                error: null,
              })),
            })),
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await listDirectoryContacts(client, {
      companyIds: ['co-target'],
      limit: 5,
    });

    expect(inFilter).toHaveBeenCalledTimes(1);
    expect(limit).not.toHaveBeenCalled();
    expect(result.summary.total).toBe(1);
    expect(result.items[0]?.companyId).toBe('co-target');
  });

  it('chunks directory company contact stats lookups for large company sets', async () => {
    const companyRows = Array.from({ length: 205 }, (_, index) => ({
      id: `co-${index + 1}`,
      company_name: `Company ${index + 1}`,
      segment: 'AI',
      status: 'active',
      website: null,
      employee_count: null,
      office_qualification: null,
      registration_date: null,
      updated_at: '2026-03-10T10:00:00Z',
      company_research: null,
    }));

    const employeeIn = vi.fn(async (_field: string, companyIds: string[]) => ({
      data: companyIds.map((companyId) => ({
        company_id: companyId,
        work_email: `${companyId}@example.com`,
        generic_email: null,
      })),
      error: null,
    }));

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'companies') {
          return {
            select: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: companyRows,
                error: null,
              })),
            })),
          };
        }

        if (table === 'employees') {
          return {
            select: vi.fn(() => ({
              in: employeeIn,
            })),
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await listDirectoryCompanies(client, {});

    expect(employeeIn).toHaveBeenCalledTimes(3);
    expect(employeeIn.mock.calls.map((call) => call[1].length)).toEqual([100, 100, 5]);
    expect(result.summary.total).toBe(205);
  });
});

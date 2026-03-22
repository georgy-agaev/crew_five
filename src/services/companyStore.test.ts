import { describe, expect, it, vi } from 'vitest';

import { applyCompanyImport, saveProcessedCompany } from './companyStore.js';

describe('companyStore saveProcessedCompany', () => {
  it('does not overwrite existing company fields with null when payload omits them', async () => {
    const companyUpdateEq = vi.fn(async () => ({ error: null }));
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'companies') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { id: 'co-1', tin: '5836634785', registration_number: 'ogrn-1' },
                  error: null,
                })),
              })),
            })),
            update: vi.fn((patch) => {
              expect(patch).toEqual({
                company_name: 'ООО "УК "Русмолко"',
                tin: '5836634785',
              });
              return {
                eq: companyUpdateEq,
              };
            }),
          };
        }

        if (table === 'employees') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { id: 'emp-1' },
                  error: null,
                })),
              })),
            })),
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: null,
                  error: null,
                })),
              })),
            })),
          };
        }

        if (table === 'employee_data_repairs') {
          return {
            insert: vi.fn(async () => ({ error: null })),
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    await saveProcessedCompany(client, {
      company: {
        company_name: 'ООО "УК "Русмолко"',
        tin: '5836634785',
      },
      employees: [],
    });

    expect(companyUpdateEq).toHaveBeenCalledWith('id', 'co-1');
  });

  it('preserves explicit nulls when caller intentionally clears a company field', async () => {
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'companies') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { id: 'co-1', tin: '5836634785', registration_number: 'ogrn-1' },
                  error: null,
                })),
              })),
            })),
            update: vi.fn((patch) => {
              expect(patch).toEqual({
                company_name: 'ООО "УК "Русмолко"',
                tin: '5836634785',
                primary_email: null,
              });
              return {
                eq: vi.fn(async () => ({ error: null })),
              };
            }),
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    await saveProcessedCompany(client, {
      company: {
        company_name: 'ООО "УК "Русмолко"',
        tin: '5836634785',
        primary_email: null,
      },
      employees: [],
    });
  });

  it('persists company financial fields and employee enrichment fields during import apply', async () => {
    const companyMaybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'companies') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: companyMaybeSingle,
              })),
            })),
            insert: vi.fn((patch) => {
              expect(patch).toEqual({
                company_name: 'Acme AI',
                tin: '1234567890',
                status: 'Active',
                processing_status: 'pending',
                revenue: 4927497000,
                balance: 1832068000,
                net_profit_loss: 38017000,
                sme_registry: 'true',
              });
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { id: 'co-1' },
                    error: null,
                  })),
                })),
              };
            }),
          };
        }

        if (table === 'employees') {
          return {
            select: vi.fn(() => {
              const query = {
                eq: vi.fn(() => query),
                maybeSingle: vi.fn(async () => ({
                  data: null,
                  error: null,
                })),
              };
              return query;
            }),
            insert: vi.fn((patch) => {
              expect(patch).toEqual({
                company_id: 'co-1',
                company_name: 'Acme AI',
                full_name: 'Alice Doe',
                processing_status: 'pending',
                source_urls: ['https://acme.ai/team'],
                phone_numbers: ['+33123456789'],
                ai_research_data: { confidence: 'high' },
              });
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { id: 'emp-1' },
                    error: null,
                  })),
                })),
              };
            }),
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await applyCompanyImport(client, [
      {
        company_name: 'Acme AI',
        tin: '1234567890',
        revenue: 4927497000,
        balance: 1832068000,
        net_profit_loss: 38017000,
        sme_registry: 'true',
        employees: [
          {
            full_name: 'Alice Doe',
            source_urls: ['https://acme.ai/team'],
            phone_numbers: ['+33123456789'],
            ai_research_data: { confidence: 'high' },
          } as any,
        ],
      },
    ]);

    expect(result.mode).toBe('apply');
    expect(companyMaybeSingle).toHaveBeenCalledTimes(2);
    expect(result.applied).toEqual([
      {
        index: 0,
        company_id: 'co-1',
        action: 'create',
      },
    ]);
  });
});

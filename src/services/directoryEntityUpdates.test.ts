import { describe, expect, it, vi } from 'vitest';

import {
  updateDirectoryCompany,
  updateDirectoryContact,
} from './directoryEntityUpdates.js';

describe('directory entity updates', () => {
  it('normalizes contact patch fields before persisting', async () => {
    const single = vi.fn(async () => ({
      data: {
        id: 'ct-1',
        full_name: 'Alice Doe',
        position: 'CTO',
        work_email: 'alice@acme.ai',
        generic_email: null,
        processing_status: 'completed',
        updated_at: '2026-03-18T12:00:00Z',
      },
      error: null,
    }));
    const client = {
      from: vi.fn((table: string) => {
        expect(table).toBe('employees');
        return {
          update: vi.fn((patch) => {
            expect(patch).toEqual({
              full_name: 'Alice Doe',
              position: 'CTO',
              work_email: 'alice@acme.ai',
              generic_email: null,
            });
            return {
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single,
                })),
              })),
            };
          }),
        };
      }),
    } as any;

    const result = await updateDirectoryContact(client, 'ct-1', {
      full_name: '  Alice Doe ',
      position: ' CTO ',
      work_email: ' Alice@Acme.AI ',
      generic_email: '',
    });

    expect(result.contactId).toBe('ct-1');
    expect(result.workEmail).toBe('alice@acme.ai');
    expect(result.genericEmail).toBeNull();
  });

  it('rejects empty required contact name updates', async () => {
    await expect(
      updateDirectoryContact({} as any, 'ct-1', { full_name: '   ' })
    ).rejects.toThrow('full_name cannot be empty');
  });

  it('normalizes company patch fields before persisting', async () => {
    const single = vi.fn(async () => ({
      data: {
        id: 'co-1',
        company_name: 'Acme AI',
        website: 'https://acme.ai',
        segment: 'AI',
        status: 'Active',
        office_qualification: 'More',
        employee_count: 42,
        primary_email: 'hello@acme.ai',
        company_description: 'Infra tooling',
        region: 'Paris',
        processing_status: 'completed',
        updated_at: '2026-03-18T12:30:00Z',
      },
      error: null,
    }));
    const client = {
      from: vi.fn((table: string) => {
        expect(table).toBe('companies');
        return {
          update: vi.fn((patch) => {
            expect(patch).toEqual({
              company_name: 'Acme AI',
              website: 'https://acme.ai',
              segment: 'AI',
              employee_count: 42,
              primary_email: 'hello@acme.ai',
            });
            return {
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single,
                })),
              })),
            };
          }),
        };
      }),
    } as any;

    const result = await updateDirectoryCompany(client, 'co-1', {
      company_name: ' Acme AI ',
      website: ' https://acme.ai ',
      segment: ' AI ',
      employee_count: 42,
      primary_email: ' Hello@Acme.AI ',
    });

    expect(result.companyId).toBe('co-1');
    expect(result.primaryEmail).toBe('hello@acme.ai');
  });

  it('rejects empty required company name updates', async () => {
    await expect(
      updateDirectoryCompany({} as any, 'co-1', { company_name: '   ' })
    ).rejects.toThrow('company_name cannot be empty');
  });
});

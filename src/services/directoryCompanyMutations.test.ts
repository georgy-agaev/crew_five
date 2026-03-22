import { describe, expect, it, vi } from 'vitest';

import {
  deleteDirectoryCompany,
  markDirectoryCompanyInvalid,
} from './directoryCompanyMutations.js';

describe('directory company mutations', () => {
  it('marks a company invalid via processing_status without deleting the row', async () => {
    const single = vi.fn(async () => ({
      data: {
        id: 'co-1',
        processing_status: 'invalid',
        updated_at: '2026-03-18T11:00:00Z',
      },
      error: null,
    }));
    const client = {
      from: vi.fn((table: string) => {
        expect(table).toBe('companies');
        return {
          update: vi.fn((patch) => {
            expect(patch).toEqual({ processing_status: 'invalid' });
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

    const result = await markDirectoryCompanyInvalid(client, 'co-1');

    expect(result).toEqual({
      companyId: 'co-1',
      processingStatus: 'invalid',
      updatedAt: '2026-03-18T11:00:00Z',
    });
  });

  it('refuses hard delete when contacts, drafts, or segment memberships exist', async () => {
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'employees') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({ count: 3, error: null })),
            })),
          };
        }
        if (table === 'drafts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({ count: 2, error: null })),
            })),
          };
        }
        if (table === 'segment_members') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({ count: 1, error: null })),
            })),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    await expect(deleteDirectoryCompany(client, 'co-1')).rejects.toThrow(
      'Company cannot be deleted because dependent contacts, drafts, or segment memberships exist'
    );
  });

  it('deletes a company when no destructive dependencies exist', async () => {
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'employees' || table === 'drafts' || table === 'segment_members') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({ count: 0, error: null })),
            })),
          };
        }
        if (table === 'companies') {
          return {
            delete: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await deleteDirectoryCompany(client, 'co-1');

    expect(result).toEqual({
      companyId: 'co-1',
      deleted: true,
    });
  });
});

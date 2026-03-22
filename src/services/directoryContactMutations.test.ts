import { describe, expect, it, vi } from 'vitest';

import {
  deleteDirectoryContact,
  markDirectoryContactInvalid,
} from './directoryContactMutations.js';

describe('directory contact mutations', () => {
  it('marks a contact invalid via processing_status without deleting the row', async () => {
    const single = vi.fn(async () => ({
      data: {
        id: 'ct-1',
        processing_status: 'invalid',
        updated_at: '2026-03-18T10:00:00Z',
      },
      error: null,
    }));
    const client = {
      from: vi.fn((table: string) => {
        expect(table).toBe('employees');
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

    const result = await markDirectoryContactInvalid(client, 'ct-1');

    expect(result).toEqual({
      contactId: 'ct-1',
      processingStatus: 'invalid',
      updatedAt: '2026-03-18T10:00:00Z',
    });
  });

  it('refuses hard delete when drafts or segment memberships exist', async () => {
    const client = {
      from: vi.fn((table: string) => {
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

    await expect(deleteDirectoryContact(client, 'ct-1')).rejects.toThrow(
      'Contact cannot be deleted because dependent drafts or segment memberships exist'
    );
  });

  it('deletes a contact when no destructive dependencies exist', async () => {
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'drafts' || table === 'segment_members') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({ count: 0, error: null })),
            })),
          };
        }
        if (table === 'employees') {
          return {
            delete: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await deleteDirectoryContact(client, 'ct-1');

    expect(result).toEqual({
      contactId: 'ct-1',
      deleted: true,
    });
  });
});

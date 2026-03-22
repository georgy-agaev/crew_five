import { describe, expect, it, vi } from 'vitest';

import { listIcpOfferingMappings, updateIcpProfileLearnings } from './icp.js';

describe('icp services', () => {
  it('normalizes and deduplicates learnings before persisting', async () => {
    const single = vi.fn(async () => ({
      data: {
        id: 'p1',
        name: 'ICP',
        offering_domain: 'voicexpert.ru',
        learnings: ['Avoid marketing tone', 'Use room language'],
        updated_at: '2026-03-17T10:00:00Z',
      },
      error: null,
    }));
    const client = {
      from: vi.fn(() => ({
        update: vi.fn((patch) => {
          expect(patch).toEqual({
            learnings: ['Avoid marketing tone', 'Use room language'],
          });
          return {
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single,
              })),
            })),
          };
        }),
      })),
    } as any;

    const result = await updateIcpProfileLearnings(client, {
      profileId: 'p1',
      learnings: [' Avoid marketing tone ', '', 'Use room language', 'Avoid marketing tone'],
    });

    expect(result.learnings).toEqual(['Avoid marketing tone', 'Use room language']);
    expect(result.offeringDomain).toBe('voicexpert.ru');
  });

  it('builds read-only ICP to offering mappings with learnings counts', async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          order: vi.fn(async () => ({
            data: [
              {
                id: 'p1',
                name: 'ICP A',
                offering_domain: 'voicexpert.ru',
                learnings: ['One', 'Two'],
              },
              {
                id: 'p2',
                name: 'ICP B',
                offering_domain: null,
                learnings: null,
              },
            ],
            error: null,
          })),
        })),
      })),
    } as any;

    const result = await listIcpOfferingMappings(client);

    expect(result).toEqual([
      {
        profileId: 'p1',
        profileName: 'ICP A',
        offeringDomain: 'voicexpert.ru',
        learningsCount: 2,
      },
      {
        profileId: 'p2',
        profileName: 'ICP B',
        offeringDomain: null,
        learningsCount: 0,
      },
    ]);
  });
});

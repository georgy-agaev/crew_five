import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/segments', () => ({
  createSegment: vi.fn().mockResolvedValue({ id: 'segment-123' }),
}));

const { createSegment } = await import('../src/services/segments');

import { segmentCreateHandler } from '../src/commands/segmentCreate';

describe('segmentCreateHandler', () => {
  it('parses filter JSON and invokes service', async () => {
    const client = {} as any;

    const result = await segmentCreateHandler(client, {
      name: 'Fintech CTOs',
      locale: 'en',
      filter: '{"field":"role","value":"CTO"}',
      description: 'Test segment',
      createdBy: 'cli-user',
    });

    expect(createSegment).toHaveBeenCalledWith(client, {
      name: 'Fintech CTOs',
      locale: 'en',
      filterDefinition: { field: 'role', value: 'CTO' },
      description: 'Test segment',
      createdBy: 'cli-user',
    });
    expect(result).toEqual({ id: 'segment-123' });
  });
});

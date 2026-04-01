import { describe, expect, it, vi } from 'vitest';

import { updateDraftContent, updateDraftStatus } from '../src/services/draftStore';

describe('draftStore recipient-context updates', () => {
  it('returns enriched draft context after status review updates', async () => {
    const single = vi
      .fn()
      .mockResolvedValueOnce({
        data: { id: 'draft-1', status: 'approved' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'draft-1',
          status: 'approved',
          contact_id: 'contact-1',
          company_id: 'company-1',
          contact: {
            id: 'contact-1',
            full_name: 'Ivan Petrov',
            position: 'CEO',
            work_email: 'ivan@acme.test',
            work_email_status: 'valid',
            generic_email: null,
            generic_email_status: null,
            company_name: 'Acme LLC',
          },
          company: {
            id: 'company-1',
            company_name: 'Acme LLC',
            website: 'https://acme.test',
          },
        },
        error: null,
      });
    const eq = vi.fn().mockReturnThis();
    const update = vi.fn().mockReturnValue({ eq, select: () => ({ single }) });
    const select = vi.fn(() => ({ eq, single }));
    const from = vi.fn((table: string) => {
      if (table !== 'drafts') throw new Error(`Unexpected table ${table}`);
      return { update, select };
    });

    const result = await updateDraftStatus({ from } as any, {
      draftId: 'draft-1',
      status: 'approved',
      reviewer: 'builder-v2',
    });

    expect(result.contact.full_name).toBe('Ivan Petrov');
    expect(result.company.company_name).toBe('Acme LLC');
    expect(result.recipient_email).toBe('ivan@acme.test');
    expect(result.sendable).toBe(true);
  });

  it('returns enriched draft context after content edits', async () => {
    const single = vi
      .fn()
      .mockResolvedValueOnce({
        data: { id: 'draft-1', subject: 'Updated' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'draft-1',
          subject: 'Updated',
          contact_id: 'contact-1',
          company_id: 'company-1',
          contact: {
            id: 'contact-1',
            full_name: 'Anna Smirnova',
            position: 'COO',
            work_email: null,
            work_email_status: null,
            generic_email: 'hello@acme.test',
            generic_email_status: 'valid',
            company_name: 'Acme LLC',
          },
          company: {
            id: 'company-1',
            company_name: 'Acme LLC',
            website: 'https://acme.test',
          },
        },
        error: null,
      });
    const eq = vi.fn().mockReturnThis();
    const update = vi.fn().mockReturnValue({ eq, select: () => ({ single }) });
    const select = vi.fn(() => ({ eq, single }));
    const from = vi.fn((table: string) => {
      if (table !== 'drafts') throw new Error(`Unexpected table ${table}`);
      return { update, select };
    });

    const result = await updateDraftContent({ from } as any, {
      draftId: 'draft-1',
      subject: 'Updated',
      body: 'Updated body',
    });

    expect(result.contact.full_name).toBe('Anna Smirnova');
    expect(result.company.company_name).toBe('Acme LLC');
    expect(result.recipient_email).toBe('hello@acme.test');
    expect(result.sendable).toBe(true);
  });
});

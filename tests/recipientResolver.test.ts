import { describe, expect, it } from 'vitest';

import { resolveRecipientEmail } from '../src/services/recipientResolver';

describe('recipientResolver', () => {
  it('prefers work email when present', () => {
    const result = resolveRecipientEmail({
      work_email: 'Lead@Company.test ',
      generic_email: 'info@company.test',
    });

    expect(result).toEqual({
      recipientEmail: 'lead@company.test',
      recipientEmailSource: 'work',
      recipientEmailKind: 'corporate',
      sendable: true,
    });
  });

  it('classifies personal mailbox work emails as personal', () => {
    const result = resolveRecipientEmail({
      work_email: 'person@mail.ru',
    });

    expect(result.recipientEmailSource).toBe('work');
    expect(result.recipientEmailKind).toBe('personal');
    expect(result.sendable).toBe(true);
  });

  it('falls back to generic email when work email is missing', () => {
    const result = resolveRecipientEmail({
      work_email: '',
      generic_email: 'sales@example.test',
    });

    expect(result).toEqual({
      recipientEmail: 'sales@example.test',
      recipientEmailSource: 'generic',
      recipientEmailKind: 'generic',
      sendable: true,
    });
  });

  it('returns missing when no usable email exists', () => {
    const result = resolveRecipientEmail({
      work_email: '',
      generic_email: null,
    });

    expect(result).toEqual({
      recipientEmail: null,
      recipientEmailSource: 'missing',
      recipientEmailKind: 'missing',
      sendable: false,
    });
  });
});

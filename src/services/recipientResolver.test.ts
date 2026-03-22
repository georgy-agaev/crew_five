import { describe, expect, it } from 'vitest';

import { resolveRecipientEmail } from './recipientResolver.js';

describe('recipientResolver', () => {
  it('falls back to generic email when work email is bounced', () => {
    expect(
      resolveRecipientEmail({
        work_email: 'alice@acme.ai',
        work_email_status: 'bounced',
        generic_email: 'hello@acme.ai',
        generic_email_status: 'unknown',
      })
    ).toEqual({
      recipientEmail: 'hello@acme.ai',
      recipientEmailSource: 'generic',
      recipientEmailKind: 'generic',
      sendable: true,
    });
  });

  it('returns missing when both emails are unusable', () => {
    expect(
      resolveRecipientEmail({
        work_email: 'alice@acme.ai',
        work_email_status: 'invalid',
        generic_email: 'hello@acme.ai',
        generic_email_status: 'bounced',
      })
    ).toEqual({
      recipientEmail: null,
      recipientEmailSource: 'missing',
      recipientEmailKind: 'missing',
      sendable: false,
    });
  });
});

const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'mail.ru',
  'bk.ru',
  'inbox.ru',
  'list.ru',
  'yandex.ru',
]);

export type RecipientEmailSource = 'work' | 'generic' | 'missing';
export type RecipientEmailKind = 'corporate' | 'personal' | 'generic' | 'missing';

export interface RecipientResolutionInput {
  work_email?: string | null;
  generic_email?: string | null;
}

export interface RecipientResolution {
  recipientEmail: string | null;
  recipientEmailSource: RecipientEmailSource;
  recipientEmailKind: RecipientEmailKind;
  sendable: boolean;
}

export function resolveRecipientEmail(input: RecipientResolutionInput): RecipientResolution {
  const workEmail = normalizeEmail(input.work_email);
  if (workEmail) {
    return {
      recipientEmail: workEmail,
      recipientEmailSource: 'work',
      recipientEmailKind: classifyWorkEmailKind(workEmail),
      sendable: true,
    };
  }

  const genericEmail = normalizeEmail(input.generic_email);
  if (genericEmail) {
    return {
      recipientEmail: genericEmail,
      recipientEmailSource: 'generic',
      recipientEmailKind: 'generic',
      sendable: true,
    };
  }

  return {
    recipientEmail: null,
    recipientEmailSource: 'missing',
    recipientEmailKind: 'missing',
    sendable: false,
  };
}

function normalizeEmail(value?: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (!match) {
    return null;
  }

  return match[0].trim().toLowerCase();
}

function classifyWorkEmailKind(email: string): RecipientEmailKind {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) {
    return 'missing';
  }

  return PERSONAL_EMAIL_DOMAINS.has(domain) ? 'personal' : 'corporate';
}

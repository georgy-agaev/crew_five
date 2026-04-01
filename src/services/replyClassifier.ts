const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const BOUNCE_SENDERS = new Set(['mailer-daemon', 'postmaster', 'mail-daemon', 'noreply']);
const BOUNCE_PATTERNS = [
  /delivery.*fail/i,
  /undeliver/i,
  /5\.\d\.\d/i,
  /user unknown/i,
  /mailbox.*full/i,
  /недоставлен/i,
  /не.*доставлен/i,
  /адрес.*не.*существует/i,
];
const VACATION_PATTERNS = [
  /в\s+отпуске/i,
  /в\s+командировке/i,
  /out\s+of\s+office/i,
  /автоответ/i,
  /auto.?reply/i,
  /буду\s+в\s+офисе\s+с/i,
  /вернусь/i,
  /отсутству/i,
];
const RESIGNATION_PATTERNS = [
  /больше\s+не\s+работа/i,
  /уволил/i,
  /покинул\s+компанию/i,
  /сменил\s+место\s+работы/i,
  /no\s+longer\s+work/i,
];
const UNSUBSCRIBE_PATTERNS = [
  /не\s+пишите/i,
  /больше\s+не\s+пиши/i,
  /удалите.*(?:адрес|email|рассылк)/i,
  /отпис/i,
  /unsubscribe/i,
  /прошу.*не\s+беспокоить/i,
];
const DECLINE_PATTERNS = [
  /не\s+интересу/i,
  /не\s+актуальн/i,
  /не\s+нужн/i,
];
const INTERESTED_PATTERNS = [
  /интересн/i,
  /актуальн/i,
  /пришлите.*(?:каталог|прайс|подробн|информац|предложен)/i,
  /давайте.*(?:созвон|встрет|обсуд|поговор)/i,
  /хотел.*бы.*(?:узнать|обсудить|посмотреть)/i,
  /расскажите.*подробн/i,
  /готов.*(?:обсудить|встрет|созвон)/i,
  /тема\s+актуальн/i,
];
const DATE_PATTERNS = [
  // eslint-disable-next-line security/detect-unsafe-regex
  /до\s+(\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+\d{4})?)/i,
  // eslint-disable-next-line security/detect-unsafe-regex
  /с\s+(\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+\d{4})?)/i,
  /until\s+((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2})/i,
];

export type ReplyClassificationCategory =
  | 'interested'
  | 'decline'
  | 'unsubscribe'
  | 'bounce'
  | 'vacation'
  | 'resignation'
  | 'needs_review';

export interface ReplyClassification {
  category: ReplyClassificationCategory;
  confidence: 'high' | 'medium' | 'low';
  returnDate: string | null;
  altContact: string | null;
  rawReason: string;
}

function matchAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

export function extractEmailAddresses(text: string): string[] {
  const matches = text.match(EMAIL_RE) ?? [];
  return Array.from(new Set(matches.map((value) => value.trim().toLowerCase())));
}

function extractDate(text: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

export function classifyInboundReply(input: {
  subject?: string | null;
  body?: string | null;
  sender?: string | null;
}): ReplyClassification {
  const subject = input.subject ?? '';
  const body = input.body ?? '';
  const sender = input.sender ?? '';
  const text = `${subject}\n${body}`.toLowerCase();
  const senderLocal = sender.split('@')[0]?.toLowerCase() ?? '';
  const extractedEmails = extractEmailAddresses(body);

  if (BOUNCE_SENDERS.has(senderLocal) || matchAny(text, BOUNCE_PATTERNS)) {
    return {
      category: 'bounce',
      confidence: 'high',
      returnDate: null,
      altContact: extractedEmails[0] ?? null,
      rawReason: 'bounce pattern matched',
    };
  }

  if (matchAny(text, RESIGNATION_PATTERNS)) {
    return {
      category: 'resignation',
      confidence: 'high',
      returnDate: null,
      altContact: extractedEmails[0] ?? null,
      rawReason: 'resignation pattern matched',
    };
  }

  if (matchAny(text, VACATION_PATTERNS)) {
    return {
      category: 'vacation',
      confidence: 'high',
      returnDate: extractDate(body) ?? extractDate(subject),
      altContact: extractedEmails[0] ?? null,
      rawReason: 'vacation pattern matched',
    };
  }

  if (matchAny(text, UNSUBSCRIBE_PATTERNS)) {
    return {
      category: 'unsubscribe',
      confidence: 'high',
      returnDate: null,
      altContact: null,
      rawReason: 'unsubscribe pattern matched',
    };
  }

  if (matchAny(text, DECLINE_PATTERNS)) {
    return {
      category: 'decline',
      confidence: 'high',
      returnDate: null,
      altContact: null,
      rawReason: 'decline pattern matched',
    };
  }

  if (matchAny(text, INTERESTED_PATTERNS)) {
    return {
      category: 'interested',
      confidence: 'medium',
      returnDate: null,
      altContact: null,
      rawReason: 'interest pattern matched',
    };
  }

  return {
    category: 'needs_review',
    confidence: 'low',
    returnDate: null,
    altContact: null,
    rawReason: 'no strong pattern matched',
  };
}

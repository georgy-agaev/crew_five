export interface ContactEventLike {
  event_type: string | null;
}

export interface ContactSuppressionState {
  replyReceived: boolean;
  bounced: boolean;
  unsubscribed: boolean;
  complaint: boolean;
  suppressed: boolean;
}

export function deriveContactSuppressionState(events: ContactEventLike[]): ContactSuppressionState {
  const replyReceived = events.some(
    (event) => event.event_type === 'reply' || event.event_type === 'replied'
  );
  const bounced = events.some((event) => event.event_type === 'bounced');
  const complaint = events.some((event) => event.event_type === 'complaint');
  const unsubscribed =
    complaint || events.some((event) => event.event_type === 'unsubscribed');

  return {
    replyReceived,
    bounced,
    unsubscribed,
    complaint,
    suppressed: bounced || unsubscribed,
  };
}

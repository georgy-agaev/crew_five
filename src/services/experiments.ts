/* eslint-disable security-node/detect-crlf */
import { createHash } from 'crypto';

export function assignVariant(subject: string): 'A' | 'B' {
  const hash = createHash('sha256').update(subject).digest('hex');
  const last = parseInt(hash.slice(-1), 16);
  return last % 2 === 0 ? 'A' : 'B';
}

export function recordExperimentResult(variant: string, outcome: Record<string, unknown>) {
  console.log(JSON.stringify({ event: 'experiment:result', variant, ...outcome }));
}

export function applyVariantToDraft<T extends { metadata?: Record<string, unknown> }>(draft: T, variant: string) {
  return { ...draft, metadata: { ...(draft.metadata ?? {}), variant } };
}

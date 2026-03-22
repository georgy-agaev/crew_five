import { describe, expect, it } from 'vitest';

import {
  findDraftForEvent,
  findDraftForOutbound,
  findEventForOutbound,
  findOutboundForDraft,
  findOutboundForEvent,
} from './campaignTrace';

describe('campaignTrace helpers', () => {
  const drafts = [{ id: 'draft-1' }, { id: 'draft-2' }] as any;
  const outbounds = [
    { id: 'out-1', draft_id: 'draft-1' },
    { id: 'out-2', draft_id: 'draft-2' },
  ] as any;
  const events = [
    { id: 'evt-1', outbound_id: 'out-1', draft_id: 'draft-1' },
    { id: 'evt-2', outbound_id: 'out-2', draft_id: 'draft-2' },
  ] as any;

  it('resolves linked records across draft, outbound, and event', () => {
    expect(findOutboundForDraft(drafts[0], outbounds)?.id).toBe('out-1');
    expect(findEventForOutbound(outbounds[0], events)?.id).toBe('evt-1');
    expect(findDraftForOutbound(outbounds[1], drafts)?.id).toBe('draft-2');
    expect(findOutboundForEvent(events[1], outbounds)?.id).toBe('out-2');
    expect(findDraftForEvent(events[0], drafts)?.id).toBe('draft-1');
  });

  it('returns null for missing links', () => {
    expect(findOutboundForDraft(null, outbounds)).toBeNull();
    expect(findEventForOutbound(null, events)).toBeNull();
    expect(findDraftForOutbound({ id: 'out-x', draft_id: null } as any, drafts)).toBeNull();
    expect(findOutboundForEvent(null, outbounds)).toBeNull();
    expect(findDraftForEvent({ id: 'evt-x', draft_id: null } as any, drafts)).toBeNull();
  });
});

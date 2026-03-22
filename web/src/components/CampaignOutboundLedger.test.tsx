import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CampaignOutboundLedger, summarizeCampaignOutbounds } from './CampaignOutboundLedger';

describe('CampaignOutboundLedger helpers', () => {
  it('summarizes sent and failed outbounds', () => {
    const summary = summarizeCampaignOutbounds([
      { id: 'o1', status: 'sent', provider: 'imap_mcp' },
      { id: 'o2', status: 'failed', provider: 'imap_mcp' },
      { id: 'o3', status: 'sent', provider: 'imap_mcp' },
    ] as any);

    expect(summary).toEqual({
      total: 3,
      sent: 2,
      failed: 1,
    });
  });

  it('renders trace actions for linked draft and event', () => {
    const onOpenDraft = vi.fn();
    const onOpenEvent = vi.fn();

    render(
      <CampaignOutboundLedger
        outbounds={[
          {
            id: 'o1',
            status: 'sent',
            provider: 'imap_mcp',
            subject: 'Hello',
            draft_id: 'd1',
          },
        ] as any}
        selectedOutboundId="o1"
        onSelectOutbound={() => {}}
        activeFilter="all"
        onFilterChange={() => {}}
        linkedDraft={{ id: 'd1', status: 'approved' }}
        linkedEvent={{ id: 'e1', event_type: 'replied' }}
        onOpenDraft={onOpenDraft}
        onOpenEvent={onOpenEvent}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open event' }));

    expect(onOpenDraft).toHaveBeenCalledWith('d1');
    expect(onOpenEvent).toHaveBeenCalledWith('e1');
  });
});

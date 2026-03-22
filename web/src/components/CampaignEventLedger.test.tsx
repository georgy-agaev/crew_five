import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CampaignEventLedger, summarizeCampaignEvents } from './CampaignEventLedger';

describe('CampaignEventLedger helpers', () => {
  it('summarizes replies, bounces, and unsubscribes', () => {
    const summary = summarizeCampaignEvents([
      { id: 'e1', outbound_id: 'o1', event_type: 'replied' } as any,
      { id: 'e2', outbound_id: 'o1', event_type: 'replied' } as any,
      { id: 'e3', outbound_id: 'o2', event_type: 'bounced' } as any,
      { id: 'e4', outbound_id: 'o3', event_type: 'unsubscribed' } as any,
    ]);

    expect(summary).toEqual({
      total: 4,
      replied: 2,
      bounced: 1,
      unsubscribed: 1,
    });
  });

  it('renders trace actions for linked outbound and draft', () => {
    const onOpenDraft = vi.fn();
    const onOpenOutbound = vi.fn();

    render(
      <CampaignEventLedger
        events={[
          {
            id: 'e1',
            outbound_id: 'o1',
            event_type: 'replied',
            subject: 'Hello',
          },
        ] as any}
        selectedEventId="e1"
        onSelectEvent={() => {}}
        activeFilter="all"
        onFilterChange={() => {}}
        linkedDraft={{ id: 'd1', status: 'approved' }}
        linkedOutbound={{ id: 'o1', status: 'sent' }}
        onOpenDraft={onOpenDraft}
        onOpenOutbound={onOpenOutbound}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open outbound' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open draft' }));

    expect(onOpenOutbound).toHaveBeenCalledWith('o1');
    expect(onOpenDraft).toHaveBeenCalledWith('d1');
  });
});

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  CampaignDraftReview,
  getDraftPatternLabel,
  getDraftReviewMetadata,
  summarizeDraftStatuses,
} from './CampaignDraftReview';

describe('CampaignDraftReview helpers', () => {
  it('summarizes draft counts by status', () => {
    const summary = summarizeDraftStatuses([
      { id: 'd1', status: 'generated' },
      { id: 'd2', status: 'approved' },
      { id: 'd3', status: 'rejected' },
      { id: 'd4', status: 'sent' },
      { id: 'd5', status: 'generated' },
    ]);

    expect(summary).toEqual({
      total: 5,
      generated: 2,
      approved: 1,
      rejected: 1,
      sent: 1,
    });
  });

  it('prefers metadata draft_pattern over pattern_mode', () => {
    expect(
      getDraftPatternLabel({
        id: 'd1',
        pattern_mode: 'strict',
        metadata: { draft_pattern: 'benefit-led-intro' },
      })
    ).toBe('benefit-led-intro');

    expect(
      getDraftPatternLabel({
        id: 'd2',
        pattern_mode: 'graceful',
      })
    ).toBe('graceful');
  });

  it('extracts review reason metadata from draft metadata', () => {
    expect(
      getDraftReviewMetadata({
        id: 'd1',
        metadata: {
          review_reason_code: 'too_generic',
          review_reason_codes: ['too_generic', 'marketing_tone'],
          review_reason_text: 'Reads like a promo blast',
          reviewed_at: '2026-03-16T18:00:00Z',
          reviewed_by: 'outreacher',
        },
      })
    ).toEqual({
      primaryCode: 'too_generic',
      primaryLabel: 'Too generic',
      reasonCodes: ['too_generic', 'marketing_tone'],
      reasonText: 'Reads like a promo blast',
      reviewedAt: '2026-03-16T18:00:00Z',
      reviewedBy: 'outreacher',
    });
  });

  it('renders trace actions for linked outbound and event', () => {
    const onOpenOutbound = vi.fn();
    const onOpenEvent = vi.fn();

    const view = render(
      <CampaignDraftReview
        drafts={[
          {
            id: 'd1',
            status: 'generated',
            subject: 'Hello',
            body: 'Body',
            contact_name: 'Alice',
            company_name: 'Example Co',
            sendable: true,
          },
        ] as any}
        selectedDraftId="d1"
        onSelectDraft={() => {}}
        activeFilter="all"
        onFilterChange={() => {}}
        reviewBusyId={null}
        onReview={() => {}}
        linkedOutbound={{ id: 'o1', status: 'sent' }}
        linkedEvent={{ id: 'e1', event_type: 'replied' }}
        onOpenOutbound={onOpenOutbound}
        onOpenEvent={onOpenEvent}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open outbound' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open event' }));

    expect(onOpenOutbound).toHaveBeenCalledWith('o1');
    expect(onOpenEvent).toHaveBeenCalledWith('e1');
  });

  it('collects rejection reason metadata before rejecting', async () => {
    const onReview = vi.fn(async () => {});

    const view = render(
      <CampaignDraftReview
        drafts={[
          {
            id: 'd1',
            status: 'generated',
            subject: 'Hello',
            body: 'Body',
            contact_name: 'Alice',
            company_name: 'Example Co',
            sendable: true,
          },
        ] as any}
        selectedDraftId="d1"
        onSelectDraft={() => {}}
        activeFilter="all"
        onFilterChange={() => {}}
        reviewBusyId={null}
        onReview={onReview}
      />
    );

    const scoped = within(view.container);

    fireEvent.click(scoped.getByRole('button', { name: 'Reject' }));
    fireEvent.change(scoped.getByLabelText('Primary rejection reason'), {
      target: { value: 'marketing_tone' },
    });
    fireEvent.click(scoped.getByRole('button', { name: 'Too generic' }));
    fireEvent.change(scoped.getByLabelText('Rejection review note'), {
      target: { value: 'Feels too promotional.' },
    });
    fireEvent.click(scoped.getByRole('button', { name: 'Save rejection' }));

    await waitFor(() => {
      expect(onReview).toHaveBeenCalledWith('d1', {
        status: 'rejected',
        metadata: {
          review_reason_code: 'marketing_tone',
          review_reason_codes: ['marketing_tone', 'too_generic'],
          review_reason_text: 'Feels too promotional.',
        },
      });
    });
  });
});

import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { CampaignLaunchDrawer } from './CampaignLaunchDrawer';

const mockSendPolicy = {
  sendTimezone: 'Europe/Moscow',
  sendWindowStartHour: 9,
  sendWindowEndHour: 17,
  sendWeekdaysOnly: true,
};

const mockPreviewResult = {
  ok: true,
  campaign: { name: 'Test Campaign', status: 'draft' },
  segment: { id: 'seg-1', version: 1, snapshotStatus: 'existing' as const },
  summary: {
    companyCount: 10,
    contactCount: 25,
    sendableContactCount: 20,
    freshCompanyCount: 8,
    staleCompanyCount: 1,
    missingCompanyCount: 1,
    senderAssignmentCount: 1,
  },
  senderPlan: { assignmentCount: 1, mailboxAccountCount: 1, senderIdentityCount: 1, domainCount: 1, domains: ['test.com'] },
  sendPolicy: mockSendPolicy,
  warnings: [{ code: 'company_enrichment_incomplete', message: 'Some companies are not enriched' }],
};

const mockLaunchResult = {
  campaign: { id: 'camp-new', name: 'Test Campaign', status: 'draft', segment_id: 'seg-1', segment_version: 1 },
  segment: { id: 'seg-1', version: 1, snapshot: {} },
  senderPlan: {
    assignments: [],
    summary: { assignmentCount: 1, mailboxAccountCount: 1, senderIdentityCount: 1, domainCount: 1, domains: ['test.com'] },
  },
  sendPolicy: mockSendPolicy,
};

vi.mock('../apiClient', () => ({
  campaignLaunchPreview: vi.fn(),
  campaignLaunch: vi.fn(),
  fetchOffers: vi.fn().mockResolvedValue([]),
  fetchIcpHypotheses: vi.fn().mockResolvedValue([]),
  fetchProjects: vi.fn().mockResolvedValue([]),
  createOffer: vi.fn(),
  createProject: vi.fn(),
}));

import { campaignLaunchPreview, campaignLaunch } from '../apiClient';
const mockPreview = vi.mocked(campaignLaunchPreview);
const mockLaunch = vi.mocked(campaignLaunch);

const segments = [{ id: 'seg-1', name: 'Enterprise CTOs' }];
const mailboxes = [
  {
    mailboxAccountId: 'mbox-1',
    senderIdentity: 'sales@test.com',
    user: 'sales',
    domain: 'test.com',
    provider: 'imap_mcp',
    campaignCount: 0,
    outboundCount: 0,
    lastSentAt: null,
  },
];

/** Helper: fill name + confirm send policy so preview button is enabled */
function fillFormAndConfirmPolicy() {
  // Fill name
  fireEvent.change(screen.getByPlaceholderText('e.g. Q2 Outreach'), { target: { value: 'Test Campaign' } });

  // Fill timezone (starts empty without hint)
  fireEvent.change(screen.getByPlaceholderText('e.g. Europe/Moscow'), { target: { value: 'Europe/Berlin' } });

  // Confirm policy
  fireEvent.click(screen.getByText('Confirm policy'));
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('CampaignLaunchDrawer', () => {
  it('does not render when closed', () => {
    render(
      <CampaignLaunchDrawer open={false} onClose={() => {}} segments={segments} mailboxes={mailboxes} />
    );
    expect(screen.queryByText('Launch campaign')).toBeNull();
  });

  it('renders form when open', () => {
    render(
      <CampaignLaunchDrawer open={true} onClose={() => {}} segments={segments} mailboxes={mailboxes} />
    );
    expect(screen.getByText('Launch campaign')).toBeTruthy();
    expect(screen.getByText('Preview launch')).toBeTruthy();
  });

  it('blocks preview when send policy is not confirmed', () => {
    render(
      <CampaignLaunchDrawer open={true} onClose={() => {}} segments={segments} mailboxes={mailboxes} />
    );

    // Fill name but don't confirm policy
    fireEvent.change(screen.getByPlaceholderText('e.g. Q2 Outreach'), { target: { value: 'Test' } });

    const previewBtn = screen.getByText('Preview launch');
    expect(previewBtn).toBeTruthy();
    expect((previewBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('prefills from hint and still requires confirmation', () => {
    render(
      <CampaignLaunchDrawer
        open={true}
        onClose={() => {}}
        segments={segments}
        mailboxes={mailboxes}
        sendPolicyHint={{ sendTimezone: 'America/New_York', sendWindowStartHour: 10, sendWindowEndHour: 18 }}
      />
    );

    // Hint prefilled but not yet confirmed
    const previewBtn = screen.getByText('Preview launch');
    fireEvent.change(screen.getByPlaceholderText('e.g. Q2 Outreach'), { target: { value: 'Test' } });
    expect((previewBtn as HTMLButtonElement).disabled).toBe(true);

    // Confirm
    fireEvent.click(screen.getByText('Confirm policy'));
    expect((previewBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows preview after form submission with confirmed policy', async () => {
    mockPreview.mockResolvedValue(mockPreviewResult);

    render(
      <CampaignLaunchDrawer open={true} onClose={() => {}} segments={segments} mailboxes={mailboxes} />
    );

    fillFormAndConfirmPolicy();
    fireEvent.click(screen.getByText('Preview launch'));

    await waitFor(() => {
      expect(screen.getByText('Launch preview')).toBeTruthy();
    });
    expect(screen.getByText('10 companies')).toBeTruthy();
    expect(screen.getByText('25 contacts')).toBeTruthy();
    expect(screen.getByText('Some companies are not enriched')).toBeTruthy();
    expect(screen.getByText('Launch')).toBeTruthy();
  });

  it('shows success after launch', async () => {
    mockPreview.mockResolvedValue(mockPreviewResult);
    mockLaunch.mockResolvedValue(mockLaunchResult);
    const onLaunched = vi.fn();

    render(
      <CampaignLaunchDrawer
        open={true}
        onClose={() => {}}
        segments={segments}
        mailboxes={mailboxes}
        onLaunched={onLaunched}
      />
    );

    fillFormAndConfirmPolicy();
    fireEvent.click(screen.getByText('Preview launch'));

    await waitFor(() => {
      expect(screen.getByText('Launch')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Launch'));

    await waitFor(() => {
      expect(screen.getByText('Campaign launched')).toBeTruthy();
    });
    expect(onLaunched).toHaveBeenCalledWith(mockLaunchResult);
  });

  it('shows error on preview failure', async () => {
    mockPreview.mockRejectedValue(new Error('Segment not found'));

    render(
      <CampaignLaunchDrawer open={true} onClose={() => {}} segments={segments} mailboxes={mailboxes} />
    );

    fillFormAndConfirmPolicy();
    fireEvent.click(screen.getByText('Preview launch'));

    await waitFor(() => {
      expect(screen.getByText('Segment not found')).toBeTruthy();
    });
  });

  it('renders in Russian', () => {
    render(
      <CampaignLaunchDrawer
        open={true}
        onClose={() => {}}
        segments={segments}
        mailboxes={mailboxes}
        language="ru"
      />
    );
    expect(screen.getByText('Запуск кампании')).toBeTruthy();
    expect(screen.getByText('Предпросмотр')).toBeTruthy();
  });
});

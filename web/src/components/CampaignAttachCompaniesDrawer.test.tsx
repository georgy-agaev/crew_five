import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { CampaignAttachCompaniesDrawer } from './CampaignAttachCompaniesDrawer';

const mockCompanies = {
  items: [
    {
      companyId: 'co-1',
      companyName: 'Acme Corp',
      segment: 'Enterprise',
      status: 'active',
      website: 'acme.com',
      employeeCount: 50,
      officeQualification: 'HQ',
      registrationDate: null,
      updatedAt: null,
      enrichment: { status: 'fresh' as const, lastUpdatedAt: null, providerHint: null },
      contacts: { total: 3, withWorkEmail: 2, withAnyEmail: 3, missingEmail: 0 },
      flags: { hasWebsite: true, hasResearch: true },
    },
    {
      companyId: 'co-2',
      companyName: 'Beta Inc',
      segment: 'SMB',
      status: 'active',
      website: 'beta.io',
      employeeCount: 10,
      officeQualification: null,
      registrationDate: null,
      updatedAt: null,
      enrichment: { status: 'stale' as const, lastUpdatedAt: null, providerHint: null },
      contacts: { total: 1, withWorkEmail: 1, withAnyEmail: 1, missingEmail: 0 },
      flags: { hasWebsite: true, hasResearch: false },
    },
  ],
  summary: {
    total: 2,
    enrichment: { fresh: 1, stale: 1, missing: 0 },
    segments: [{ segment: 'Enterprise', count: 1 }, { segment: 'SMB', count: 1 }],
  },
};

const mockAttachResult = {
  campaignId: 'camp-1',
  summary: {
    requestedCompanyCount: 2,
    attachedCompanyCount: 1,
    alreadyPresentCompanyCount: 1,
    blockedCompanyCount: 0,
    invalidCompanyCount: 0,
    insertedContactCount: 3,
    alreadyPresentContactCount: 1,
  },
  items: [
    { companyId: 'co-1', companyName: 'Acme Corp', status: 'attached' as const, insertedContactCount: 3, alreadyPresentContactCount: 0, reason: null },
    { companyId: 'co-2', companyName: 'Beta Inc', status: 'already_present' as const, insertedContactCount: 0, alreadyPresentContactCount: 1, reason: null },
  ],
};

vi.mock('../apiClient', () => ({
  fetchDirectoryCompanies: vi.fn(),
  attachCompaniesToCampaign: vi.fn(),
}));

import { fetchDirectoryCompanies, attachCompaniesToCampaign } from '../apiClient';
const mockFetchDir = vi.mocked(fetchDirectoryCompanies);
const mockAttach = vi.mocked(attachCompaniesToCampaign);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('CampaignAttachCompaniesDrawer', () => {
  it('does not render when closed', () => {
    render(
      <CampaignAttachCompaniesDrawer open={false} campaignId="camp-1" onClose={() => {}} />
    );
    expect(screen.queryByText('Attach companies')).toBeNull();
  });

  it('loads and shows companies', async () => {
    mockFetchDir.mockResolvedValue(mockCompanies);

    render(
      <CampaignAttachCompaniesDrawer open={true} campaignId="camp-1" onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeTruthy();
    });
    expect(screen.getByText('Beta Inc')).toBeTruthy();
  });

  it('enables attach button only when companies selected', async () => {
    mockFetchDir.mockResolvedValue(mockCompanies);

    render(
      <CampaignAttachCompaniesDrawer open={true} campaignId="camp-1" onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeTruthy();
    });

    // Button disabled with 0 selected
    const attachBtn = screen.getByText('Attach (0)');
    expect((attachBtn as HTMLButtonElement).disabled).toBe(true);

    // Select a company
    fireEvent.click(screen.getByText('Acme Corp'));

    const enabledBtn = screen.getByText('Attach (1)');
    expect((enabledBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows result after attach', async () => {
    mockFetchDir.mockResolvedValue(mockCompanies);
    mockAttach.mockResolvedValue(mockAttachResult);
    const onAttached = vi.fn();

    render(
      <CampaignAttachCompaniesDrawer open={true} campaignId="camp-1" onClose={() => {}} onAttached={onAttached} />
    );

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeTruthy();
    });

    // Select all and attach
    fireEvent.click(screen.getByText('Select all'));
    fireEvent.click(screen.getByText('Attach (2)'));

    await waitFor(() => {
      expect(screen.getByText('Attach result')).toBeTruthy();
    });
    expect(screen.getByText('1 attached')).toBeTruthy();
    expect(screen.getByText('1 already present')).toBeTruthy();
    expect(screen.getByText('3 contacts added')).toBeTruthy();
    expect(onAttached).toHaveBeenCalled();
  });

  it('shows error on attach failure', async () => {
    mockFetchDir.mockResolvedValue(mockCompanies);
    mockAttach.mockRejectedValue(new Error('Campaign is in wrong status'));

    render(
      <CampaignAttachCompaniesDrawer open={true} campaignId="camp-1" onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Acme Corp'));
    fireEvent.click(screen.getByText('Attach (1)'));

    await waitFor(() => {
      expect(screen.getByText('Campaign is in wrong status')).toBeTruthy();
    });
  });

  it('renders in Russian', async () => {
    mockFetchDir.mockResolvedValue(mockCompanies);

    render(
      <CampaignAttachCompaniesDrawer open={true} campaignId="camp-1" onClose={() => {}} language="ru" />
    );

    await waitFor(() => {
      expect(screen.getByText('Добавить компании')).toBeTruthy();
    });
  });
});

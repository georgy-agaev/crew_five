import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as apiClient from '../apiClient';
import { ContactsWorkspacePage } from './ContactsWorkspacePage';

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

const mockCompanies: apiClient.DirectoryCompaniesView = {
  items: [
    {
      companyId: 'co-1',
      companyName: 'Acme AI',
      segment: 'AI',
      status: 'active',
      website: 'https://acme.ai',
      employeeCount: 42,
      officeQualification: 'More',
      registrationDate: '2024-01-10',
      updatedAt: '2026-03-10T10:00:00Z',
      enrichment: { status: 'fresh', lastUpdatedAt: '2026-03-16T10:00:00Z', providerHint: 'firecrawl' },
      contacts: { total: 3, withWorkEmail: 2, withAnyEmail: 3, missingEmail: 0 },
      flags: { hasWebsite: true, hasResearch: true },
    },
    {
      companyId: 'co-2',
      companyName: 'Beta Corp',
      segment: 'Fintech',
      status: 'active',
      website: null,
      employeeCount: 10,
      officeQualification: null,
      registrationDate: null,
      updatedAt: null,
      enrichment: { status: 'missing', lastUpdatedAt: null, providerHint: null },
      contacts: { total: 1, withWorkEmail: 0, withAnyEmail: 0, missingEmail: 1 },
      flags: { hasWebsite: false, hasResearch: false },
    },
  ],
  summary: {
    total: 2,
    enrichment: { fresh: 1, stale: 0, missing: 1 },
    segments: [{ segment: 'AI', count: 1 }, { segment: 'Fintech', count: 1 }],
  },
};

const mockContacts: apiClient.DirectoryContactsView = {
  items: [
    {
      contactId: 'ct-1',
      companyId: 'co-1',
      companyName: 'Acme AI',
      companySegment: 'AI',
      companyStatus: 'active',
      fullName: 'Alice Doe',
      position: 'CTO',
      workEmail: 'alice@acme.ai',
      genericEmail: null,
      emailStatus: 'work',
      workEmailStatus: 'valid',
      genericEmailStatus: 'unknown',
      processingStatus: 'completed',
      updatedAt: '2026-03-16T11:00:00Z',
      enrichment: { status: 'fresh', lastUpdatedAt: '2026-03-16T12:00:00Z', providerHint: 'exa' },
    },
  ],
  summary: {
    total: 1,
    emailStatus: { work: 1, generic: 0, missing: 0 },
    enrichment: { fresh: 1, stale: 0, missing: 0 },
  },
};

function setupWithContacts() {
  vi.spyOn(apiClient, 'fetchDirectoryCompanies').mockResolvedValue(mockCompanies);
  vi.spyOn(apiClient, 'fetchDirectoryContacts').mockResolvedValue(mockContacts);
}

describe('ContactsWorkspacePage', () => {
  it('renders company list with summary', async () => {
    vi.spyOn(apiClient, 'fetchDirectoryCompanies').mockResolvedValue(mockCompanies);

    render(<ContactsWorkspacePage />);

    expect(await screen.findByText('Acme AI')).toBeTruthy();
    expect(screen.getByText('Beta Corp')).toBeTruthy();
    expect(screen.getByLabelText('Total companies').textContent).toContain('2 companies');
  });

  it('shows contacts when company is selected', async () => {
    setupWithContacts();

    render(<ContactsWorkspacePage />);

    await screen.findByText('Acme AI');
    fireEvent.click(screen.getByText('Acme AI'));

    expect(await screen.findByText('Alice Doe')).toBeTruthy();
    expect(screen.getByText('CTO')).toBeTruthy();
    expect(screen.getByText('alice@acme.ai')).toBeTruthy();
  });

  it('filters companies by enrichment status', async () => {
    const fetchSpy = vi.spyOn(apiClient, 'fetchDirectoryCompanies').mockResolvedValue(mockCompanies);

    render(<ContactsWorkspacePage />);
    await screen.findByText('Acme AI');

    fireEvent.click(screen.getByRole('button', { name: 'fresh' }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ enrichmentStatus: 'fresh' })
      );
    });
  });

  it('filters contacts by email status', async () => {
    setupWithContacts();
    const contactsSpy = vi.spyOn(apiClient, 'fetchDirectoryContacts');

    render(<ContactsWorkspacePage />);
    await screen.findByText('Acme AI');
    fireEvent.click(screen.getByText('Acme AI'));
    await screen.findByText('Alice Doe');

    fireEvent.click(screen.getByRole('button', { name: 'work' }));

    await waitFor(() => {
      expect(contactsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ emailStatus: 'work' })
      );
    });
  });

  it('shows loading skeleton', () => {
    vi.spyOn(apiClient, 'fetchDirectoryCompanies').mockReturnValue(new Promise(() => {}));

    render(<ContactsWorkspacePage />);

    expect(screen.getByText('Contacts')).toBeTruthy();
    expect(screen.queryByText('Acme AI')).toBeNull();
  });

  it('shows empty state when no companies match', async () => {
    vi.spyOn(apiClient, 'fetchDirectoryCompanies').mockResolvedValue({
      items: [],
      summary: { total: 0, enrichment: { fresh: 0, stale: 0, missing: 0 }, segments: [] },
    });

    render(<ContactsWorkspacePage />);

    expect(await screen.findByText('No companies match this filter.')).toBeTruthy();
  });

  it('shows placeholder when no company selected', async () => {
    vi.spyOn(apiClient, 'fetchDirectoryCompanies').mockResolvedValue(mockCompanies);

    render(<ContactsWorkspacePage />);
    await screen.findByText('Acme AI');

    expect(screen.getByText('Select a company to view contacts')).toBeTruthy();
  });

  it('searches companies', async () => {
    const fetchSpy = vi.spyOn(apiClient, 'fetchDirectoryCompanies').mockResolvedValue(mockCompanies);

    render(<ContactsWorkspacePage />);
    await screen.findByText('Acme AI');

    fireEvent.change(screen.getByLabelText('Search companies'), {
      target: { value: 'beta' },
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'beta' })
      );
    });
  });

  // ---- Contact action tests ----

  it('marks contact as invalid and refetches', async () => {
    setupWithContacts();
    const markSpy = vi.spyOn(apiClient, 'markDirectoryContactInvalid').mockResolvedValue({
      contactId: 'ct-1',
      processingStatus: 'invalid',
      updatedAt: '2026-03-18T10:00:00Z',
    });

    render(<ContactsWorkspacePage />);
    await screen.findByText('Acme AI');
    fireEvent.click(screen.getByText('Acme AI'));
    await screen.findByText('Alice Doe');

    fireEvent.click(screen.getByLabelText('Mark invalid Alice Doe'));

    await waitFor(() => {
      expect(markSpy).toHaveBeenCalledWith('ct-1');
    });
    // Should trigger a refetch (reloadKey increments)
    await waitFor(() => {
      expect(apiClient.fetchDirectoryContacts).toHaveBeenCalledTimes(2);
    });
  });

  it('deletes contact with confirmation and refetches', async () => {
    setupWithContacts();
    const deleteSpy = vi.spyOn(apiClient, 'deleteDirectoryContact').mockResolvedValue({
      contactId: 'ct-1',
      deleted: true,
    });

    render(<ContactsWorkspacePage />);
    await screen.findByText('Acme AI');
    fireEvent.click(screen.getByText('Acme AI'));
    await screen.findByText('Alice Doe');

    // Click delete — should show confirmation
    fireEvent.click(screen.getByLabelText('Delete Alice Doe'));
    expect(screen.getByText('Delete?')).toBeTruthy();

    // Confirm
    fireEvent.click(screen.getByLabelText('Confirm delete Alice Doe'));

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('ct-1');
    });
    await waitFor(() => {
      expect(apiClient.fetchDirectoryContacts).toHaveBeenCalledTimes(2);
    });
  });

  it('shows conflict error on delete 409', async () => {
    setupWithContacts();
    const err = new Error('Conflict');
    (err as any).apiError = {
      statusCode: 409,
      message: 'Contact cannot be deleted',
      details: { details: { drafts: 2, segmentMemberships: 1 } },
    };
    vi.spyOn(apiClient, 'deleteDirectoryContact').mockRejectedValue(err);

    render(<ContactsWorkspacePage />);
    await screen.findByText('Acme AI');
    fireEvent.click(screen.getByText('Acme AI'));
    await screen.findByText('Alice Doe');

    fireEvent.click(screen.getByLabelText('Delete Alice Doe'));
    fireEvent.click(screen.getByLabelText('Confirm delete Alice Doe'));

    expect(await screen.findByText(/Cannot delete.*2 draft\(s\).*1 segment membership\(s\)/)).toBeTruthy();
  });

  it('cancels delete confirmation', async () => {
    setupWithContacts();

    render(<ContactsWorkspacePage />);
    await screen.findByText('Acme AI');
    fireEvent.click(screen.getByText('Acme AI'));
    await screen.findByText('Alice Doe');

    fireEvent.click(screen.getByLabelText('Delete Alice Doe'));
    expect(screen.getByText('Delete?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Delete?')).toBeNull();
  });

  // ---- Persistence validation ----

  it('clears stale persisted company selection', async () => {
    localStorage.setItem('c5:contacts:company', JSON.stringify('nonexistent-co'));
    vi.spyOn(apiClient, 'fetchDirectoryCompanies').mockResolvedValue(mockCompanies);
    const contactsSpy = vi.spyOn(apiClient, 'fetchDirectoryContacts');

    render(<ContactsWorkspacePage />);
    await screen.findByText('Acme AI');

    // Should show placeholder, not try to load contacts for stale id
    expect(screen.getByText('Select a company to view contacts')).toBeTruthy();
    expect(contactsSpy).not.toHaveBeenCalled();
  });

  // ---- Deliverability ----

  it('shows bounced work email status without marking contact invalid', async () => {
    const bouncedContacts: apiClient.DirectoryContactsView = {
      items: [{
        ...mockContacts.items[0],
        workEmail: 'alice@acme.ai',
        genericEmail: 'info@acme.ai',
        workEmailStatus: 'bounced',
        genericEmailStatus: 'unknown',
        processingStatus: 'completed',
      }],
      summary: mockContacts.summary,
    };
    vi.spyOn(apiClient, 'fetchDirectoryCompanies').mockResolvedValue(mockCompanies);
    vi.spyOn(apiClient, 'fetchDirectoryContacts').mockResolvedValue(bouncedContacts);

    render(<ContactsWorkspacePage />);
    await screen.findByText('Acme AI');
    fireEvent.click(screen.getByText('Acme AI'));
    await screen.findByText('Alice Doe');

    // Should show bounced badge, not dim the contact (processingStatus is completed)
    expect(screen.getByText('bounced')).toBeTruthy();
    // Contact row should NOT have opacity (processingStatus !== 'invalid')
    const contactRow = screen.getByText('Alice Doe').closest('.od-employee-item');
    expect(contactRow?.getAttribute('style')).not.toContain('opacity');
  });

  it('shows sendability fallback in detail when work email bounced but generic usable', async () => {
    const fallbackContacts: apiClient.DirectoryContactsView = {
      items: [{
        ...mockContacts.items[0],
        workEmail: 'alice@acme.ai',
        genericEmail: 'info@acme.ai',
        workEmailStatus: 'bounced',
        genericEmailStatus: 'unknown',
        processingStatus: 'completed',
      }],
      summary: mockContacts.summary,
    };
    vi.spyOn(apiClient, 'fetchDirectoryCompanies').mockResolvedValue(mockCompanies);
    vi.spyOn(apiClient, 'fetchDirectoryContacts').mockResolvedValue(fallbackContacts);

    render(<ContactsWorkspacePage />);
    await screen.findByText('Acme AI');
    fireEvent.click(screen.getByText('Acme AI'));
    await screen.findByText('Alice Doe');
    // Click to open detail
    fireEvent.click(screen.getByText('Alice Doe'));

    expect(await screen.findByText(/Sendable via generic/)).toBeTruthy();
  });
});

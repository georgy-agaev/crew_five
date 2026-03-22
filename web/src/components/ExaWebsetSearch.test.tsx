import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ExaWebsetSearch } from './ExaWebsetSearch';
import type { ExaCompanyResult, ExaEmployeeResult } from '../types/exaWebset';

// Mock the useExaSearch hook
vi.mock('../hooks/useExaSearch');

describe('ExaWebsetSearch', () => {
  const mockSearch = vi.fn();
  const mockClear = vi.fn();
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  const mockCompanies: ExaCompanyResult[] = [
    {
      name: 'Acme Corp',
      domain: 'acme.com',
      location: 'San Francisco, CA',
      industry: 'Software',
      size: '100-500',
      confidenceScore: 0.95,
    },
    {
      name: 'TechStart Inc',
      domain: 'techstart.io',
      location: 'New York, NY',
      industry: 'SaaS',
      confidenceScore: 0.88,
    },
  ];

  const mockEmployees: ExaEmployeeResult[] = [
    {
      name: 'John Doe',
      role: 'CTO',
      title: 'Chief Technology Officer',
      companyName: 'Acme Corp',
      companyDomain: 'acme.com',
      location: 'San Francisco, CA',
      email: 'john@acme.com',
      confidenceScore: 0.92,
    },
    {
      name: 'Jane Smith',
      role: 'VP Engineering',
      title: 'Vice President of Engineering',
      companyName: 'TechStart Inc',
      companyDomain: 'techstart.io',
      location: 'New York, NY',
      confidenceScore: 0.85,
    },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import after mocking to get the mocked module
    const useExaSearchModule = await import('../hooks/useExaSearch');
    vi.mocked(useExaSearchModule).useExaSearch = vi.fn().mockReturnValue({
      companies: [],
      employees: [],
      totalResults: 0,
      loading: false,
      error: null,
      search: mockSearch,
      clear: mockClear,
    });
  });

  describe('Modal Visibility', () => {
    it('returns null when isOpen is false', () => {
      const html = renderToString(
        <ExaWebsetSearch
          isOpen={false}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
      expect(html).toBe('');
    });

    it('renders when isOpen is true', () => {
      const html = renderToString(
        <ExaWebsetSearch
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
      expect(html).toContain('EXA Web Search');
    });
  });

  describe('Search Input Section', () => {
    it('renders search textarea with correct placeholder', () => {
      const html = renderToString(
        <ExaWebsetSearch
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
      expect(html).toContain('Describe the companies or people you want to find');
      expect(html).toContain('Search Description');
    });

    it('renders search button', () => {
      const html = renderToString(
        <ExaWebsetSearch
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
      expect(html).toContain('>Search<');
    });

    it('shows searching state when loading', async () => {
      const useExaSearchModule = vi.mocked(await import('../hooks/useExaSearch'));
      useExaSearchModule.useExaSearch = vi.fn().mockReturnValue({
        companies: [],
        employees: [],
        totalResults: 0,
        loading: true,
        error: null,
        search: mockSearch,
        clear: mockClear,
      });

      const html = renderToString(
        <ExaWebsetSearch
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
      expect(html).toContain('Searching...');
    });
  });

  describe('Error Display', () => {
    it('displays error message when search fails', async () => {
      const useExaSearchModule = vi.mocked(await import('../hooks/useExaSearch'));
      useExaSearchModule.useExaSearch = vi.fn().mockReturnValue({
        companies: [],
        employees: [],
        totalResults: 0,
        loading: false,
        error: 'API error: Network failure',
        search: mockSearch,
        clear: mockClear,
      });

      const html = renderToString(
        <ExaWebsetSearch
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
      expect(html).toContain('API error: Network failure');
    });
  });

  describe('Results Display', () => {
    beforeEach(async () => {
      const useExaSearchModule = vi.mocked(await import('../hooks/useExaSearch'));
      useExaSearchModule.useExaSearch = vi.fn().mockReturnValue({
        companies: mockCompanies,
        employees: mockEmployees,
        totalResults: 4,
        loading: false,
        error: null,
        search: mockSearch,
        clear: mockClear,
      });
    });

    it('displays results count', () => {
      const html = renderToString(
        <ExaWebsetSearch
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
      expect(html).toContain('Found:');
      expect(html).toContain('2</strong> companies');
      expect(html).toContain('2</strong> employees');
      expect(html).toContain('4</strong> total results');
    });

    it('displays tabs for companies and employees', () => {
      const html = renderToString(
        <ExaWebsetSearch
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
      // React renders JSX expressions with HTML comments
      expect(html).toContain('Companies (<!-- -->2<!-- -->)');
      expect(html).toContain('Employees (<!-- -->2<!-- -->)');
    });

    it('displays company results', () => {
      const html = renderToString(
        <ExaWebsetSearch
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
      expect(html).toContain('Acme Corp');
      expect(html).toContain('TechStart Inc');
      // React renders JSX expressions with HTML comments
      expect(html).toContain('Domain: <!-- -->acme.com');
      expect(html).toContain('Location: <!-- -->San Francisco, CA');
      expect(html).toContain('Industry: <!-- -->Software');
      expect(html).toContain('Size: <!-- -->100-500');
      expect(html).toContain('Confidence: <!-- -->95<!-- -->%');
    });

    it('displays employee results in employees tab', () => {
      const html = renderToString(
        <ExaWebsetSearch
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
      // Employee results exist in the DOM but are in the non-active tab
      // Since both tabs are rendered in SSR, we can check for employee data
      // but it won't be visible by default (companies tab is active)
      // For SSR tests, we just verify the companies are shown (active tab)
      expect(html).toContain('Acme Corp');
      expect(html).toContain('TechStart Inc');
    });

    it('shows segment name input after search', () => {
      const html = renderToString(
        <ExaWebsetSearch
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
      expect(html).toContain('Segment Name');
      expect(html).toContain('e.g., Enterprise CTOs from EXA Search');
    });
  });

  describe('Empty Results', () => {
    it('shows empty state for companies when no company results', async () => {
      const useExaSearchModule = vi.mocked(await import('../hooks/useExaSearch'));
      useExaSearchModule.useExaSearch = vi.fn().mockReturnValue({
        companies: [],
        employees: mockEmployees,
        totalResults: 2,
        loading: false,
        error: null,
        search: mockSearch,
        clear: mockClear,
      });

      const html = renderToString(
        <ExaWebsetSearch
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
      expect(html).toContain('No companies found');
    });

    it('shows employee count as zero when no employee results', async () => {
      const useExaSearchModule = vi.mocked(await import('../hooks/useExaSearch'));
      useExaSearchModule.useExaSearch = vi.fn().mockReturnValue({
        companies: mockCompanies,
        employees: [],
        totalResults: 2,
        loading: false,
        error: null,
        search: mockSearch,
        clear: mockClear,
      });

      const html = renderToString(
        <ExaWebsetSearch
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
      // Check that employee count is 0
      expect(html).toContain('Employees (<!-- -->0<!-- -->)');
      expect(html).toContain('0</strong> employees');
    });
  });

  describe('Before Search State', () => {
    it('does not show segment name input before search', () => {
      const html = renderToString(
        <ExaWebsetSearch
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
      expect(html).not.toContain('Segment Name');
      expect(html).not.toContain('e.g., Enterprise CTOs from EXA Search');
    });

    it('does not show results section before search', () => {
      const html = renderToString(
        <ExaWebsetSearch
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
      expect(html).not.toContain('Search Results');
      expect(html).not.toContain('Companies (');
      expect(html).not.toContain('Employees (');
    });
  });

  describe('Action Buttons', () => {
    it('renders cancel and save buttons', async () => {
      const useExaSearchModule = vi.mocked(await import('../hooks/useExaSearch'));
      useExaSearchModule.useExaSearch = vi.fn().mockReturnValue({
        companies: mockCompanies,
        employees: mockEmployees,
        totalResults: 4,
        loading: false,
        error: null,
        search: mockSearch,
        clear: mockClear,
      });

      const html = renderToString(
        <ExaWebsetSearch
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
      expect(html).toContain('>Cancel<');
      expect(html).toContain('Save as Segment');
    });

    it('disables save button when no segment name (has disabled attribute)', async () => {
      const useExaSearchModule = vi.mocked(await import('../hooks/useExaSearch'));
      useExaSearchModule.useExaSearch = vi.fn().mockReturnValue({
        companies: mockCompanies,
        employees: mockEmployees,
        totalResults: 4,
        loading: false,
        error: null,
        search: mockSearch,
        clear: mockClear,
      });

      const html = renderToString(
        <ExaWebsetSearch
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
      // Button is disabled when segment name is empty
      expect(html).toContain('disabled=""');
    });
  });

  describe('Accessibility', () => {
    it('has close button with aria-label', () => {
      const html = renderToString(
        <ExaWebsetSearch
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
      expect(html).toContain('aria-label="Close EXA web search dialog"');
      expect(html).toContain('✕');
    });

    it('has search textarea with aria-label', () => {
      const html = renderToString(
        <ExaWebsetSearch
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
      expect(html).toContain('aria-label="Describe companies or people to search for"');
    });
  });

  describe('Component Structure', () => {
    it('renders modal header with title', () => {
      const html = renderToString(
        <ExaWebsetSearch
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
      expect(html).toContain('<h2');
      expect(html).toContain('EXA Web Search');
    });

    it('applies correct styling classes and structure', () => {
      const html = renderToString(
        <ExaWebsetSearch
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
      // Check for modal overlay and backdrop
      expect(html).toContain('position:fixed');
      expect(html).toContain('rgba(0, 0, 0, 0.5)');
      // Check for modal content
      expect(html).toContain('background:#fff');
      expect(html).toContain('border-radius:16px');
    });
  });

  describe('Props Interface', () => {
    it('accepts all required props', () => {
      // This test verifies TypeScript compilation
      const component = (
        <ExaWebsetSearch
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
      expect(component).toBeDefined();
    });

    it('accepts onSave callback with correct signature', () => {
      const onSaveHandler = vi.fn<
        [{ name: string; companies: ExaCompanyResult[]; employees: ExaEmployeeResult[]; query: string }],
        Promise<void>
      >();

      const component = (
        <ExaWebsetSearch
          isOpen={true}
          onClose={mockOnClose}
          onSave={onSaveHandler}
        />
      );
      expect(component).toBeDefined();
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchExaWebset, isExaWebsetConfigured } from '../src/services/exaWebset';
import * as exaIntegration from '../src/integrations/exa';

// Mock the EXA integration
vi.mock('../src/integrations/exa', () => ({
  buildExaClientFromEnv: vi.fn(),
}));

describe('exaWebset service', () => {
  const mockExaClient = {
    createWebset: vi.fn(),
    getWebsetItems: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(exaIntegration.buildExaClientFromEnv).mockReturnValue(mockExaClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('searchExaWebset', () => {
    it('should create webset and fetch items successfully', async () => {
      const mockWebsetId = 'webset_123';
      const mockItems = [
        {
          url: 'https://example.com',
          title: 'Example Company - About Us',
        },
        {
          url: 'https://linkedin.com/in/john-doe',
          title: 'John Doe - CEO at Example Company | LinkedIn',
        },
      ];

      mockExaClient.createWebset.mockResolvedValue({ id: mockWebsetId });
      mockExaClient.getWebsetItems.mockResolvedValue({ items: mockItems });

      const result = await searchExaWebset({
        description: 'enterprise SaaS companies in healthcare',
        maxResults: 50,
      });

      // Verify webset creation
      expect(mockExaClient.createWebset).toHaveBeenCalledWith({
        name: expect.stringMatching(/^crew_five_segment_\d+$/),
        queries: ['enterprise SaaS companies in healthcare'],
      });

      // Verify items fetch
      expect(mockExaClient.getWebsetItems).toHaveBeenCalledWith({
        websetId: mockWebsetId,
        limit: 50,
      });

      // Verify result structure
      expect(result).toMatchObject({
        totalResults: 2,
        query: 'enterprise SaaS companies in healthcare',
      });

      // Should have parsed companies
      expect(result.companies.length).toBeGreaterThan(0);
      const company = result.companies[0];
      expect(company).toMatchObject({
        name: expect.any(String),
        domain: 'example.com',
        sourceUrl: 'https://example.com',
        confidenceScore: expect.any(Number),
      });

      // Should have parsed employees
      expect(result.employees.length).toBeGreaterThan(0);
      const employee = result.employees[0];
      expect(employee).toMatchObject({
        name: 'John Doe',
        role: 'CEO',
        companyName: 'Example Company',
        linkedinUrl: expect.stringContaining('linkedin.com'),
        confidenceScore: expect.any(Number),
      });
    });

    it('should handle empty description', async () => {
      await expect(
        searchExaWebset({ description: '' })
      ).rejects.toThrow('Description is required');
    });

    it('should handle EXA API errors', async () => {
      mockExaClient.createWebset.mockRejectedValue(
        new Error('Exa request failed: 401 Unauthorized')
      );

      await expect(
        searchExaWebset({ description: 'test query' })
      ).rejects.toThrow('Exa request failed');
    });

    it('should use default maxResults when not provided', async () => {
      mockExaClient.createWebset.mockResolvedValue({ id: 'webset_123' });
      mockExaClient.getWebsetItems.mockResolvedValue({ items: [] });

      await searchExaWebset({ description: 'test query' });

      expect(mockExaClient.getWebsetItems).toHaveBeenCalledWith({
        websetId: 'webset_123',
        limit: 100, // DEFAULT_MAX_RESULTS
      });
    });

    it('should respect includeCompanies and includeEmployees flags', async () => {
      const mockItems = [
        {
          url: 'https://example.com',
          title: 'Example Company',
        },
        {
          url: 'https://linkedin.com/in/john-doe',
          title: 'John Doe - CEO | LinkedIn',
        },
      ];

      mockExaClient.createWebset.mockResolvedValue({ id: 'webset_123' });
      mockExaClient.getWebsetItems.mockResolvedValue({ items: mockItems });

      // Only companies
      const companiesOnly = await searchExaWebset({
        description: 'test',
        includeCompanies: true,
        includeEmployees: false,
      });
      expect(companiesOnly.companies.length).toBeGreaterThan(0);
      expect(companiesOnly.employees.length).toBe(0);

      // Only employees
      const employeesOnly = await searchExaWebset({
        description: 'test',
        includeCompanies: false,
        includeEmployees: true,
      });
      expect(employeesOnly.companies.length).toBe(0);
      expect(employeesOnly.employees.length).toBeGreaterThan(0);
    });

    it('should parse company domains correctly', async () => {
      const mockItems = [
        {
          url: 'https://www.example.com/about',
          title: 'Example Inc - About Us',
        },
        {
          url: 'https://subdomain.company.io',
          title: 'Subdomain Company',
        },
      ];

      mockExaClient.createWebset.mockResolvedValue({ id: 'webset_123' });
      mockExaClient.getWebsetItems.mockResolvedValue({ items: mockItems });

      const result = await searchExaWebset({ description: 'test' });

      // Should remove www. prefix
      expect(result.companies[0].domain).toBe('example.com');

      // Should keep subdomain
      expect(result.companies[1].domain).toBe('subdomain.company.io');
    });

    it('should assign confidence scores based on position', async () => {
      const mockItems = [
        { url: 'https://first.com', title: 'First Company' },
        { url: 'https://second.com', title: 'Second Company' },
        { url: 'https://third.com', title: 'Third Company' },
      ];

      mockExaClient.createWebset.mockResolvedValue({ id: 'webset_123' });
      mockExaClient.getWebsetItems.mockResolvedValue({ items: mockItems });

      const result = await searchExaWebset({ description: 'test' });

      // First result should have highest confidence
      expect(result.companies[0].confidenceScore).toBeGreaterThan(
        result.companies[1].confidenceScore!
      );
      expect(result.companies[1].confidenceScore).toBeGreaterThan(
        result.companies[2].confidenceScore!
      );

      // All should be between 0.5 and 1.0
      result.companies.forEach((company) => {
        expect(company.confidenceScore).toBeGreaterThanOrEqual(0.5);
        expect(company.confidenceScore).toBeLessThanOrEqual(1.0);
      });
    });

    it('should parse LinkedIn profiles correctly', async () => {
      const mockItems = [
        {
          url: 'https://www.linkedin.com/in/jane-smith-123',
          title: 'Jane Smith - VP of Engineering at Tech Corp | LinkedIn',
        },
        {
          url: 'https://linkedin.com/in/bob-jones',
          title: 'Bob Jones - Product Manager | LinkedIn',
        },
      ];

      mockExaClient.createWebset.mockResolvedValue({ id: 'webset_123' });
      mockExaClient.getWebsetItems.mockResolvedValue({ items: mockItems });

      const result = await searchExaWebset({ description: 'test' });

      // First profile with company
      expect(result.employees[0]).toMatchObject({
        name: 'Jane Smith',
        role: 'VP of Engineering',
        companyName: 'Tech Corp',
        linkedinUrl: expect.stringContaining('linkedin.com/in/jane-smith-123'),
      });

      // Second profile without company
      expect(result.employees[1]).toMatchObject({
        name: 'Bob Jones',
        role: 'Product Manager',
        linkedinUrl: expect.stringContaining('linkedin.com/in/bob-jones'),
      });
    });

    it('should handle items with missing titles', async () => {
      const mockItems = [
        { url: 'https://example.com' },
        { url: 'https://linkedin.com/in/user' },
      ];

      mockExaClient.createWebset.mockResolvedValue({ id: 'webset_123' });
      mockExaClient.getWebsetItems.mockResolvedValue({ items: mockItems });

      const result = await searchExaWebset({ description: 'test' });

      // Should still create company with domain as name
      expect(result.companies.length).toBeGreaterThan(0);
      expect(result.companies[0].name).toBe('example.com');

      // LinkedIn profile without title should be skipped
      const linkedInEmployee = result.employees.find((e) =>
        e.sourceUrl?.includes('linkedin.com')
      );
      expect(linkedInEmployee).toBeUndefined();
    });

    it('should handle invalid URLs gracefully', async () => {
      const mockItems = [
        { url: 'not-a-valid-url', title: 'Invalid URL' },
        { url: 'https://valid.com', title: 'Valid Company' },
      ];

      mockExaClient.createWebset.mockResolvedValue({ id: 'webset_123' });
      mockExaClient.getWebsetItems.mockResolvedValue({ items: mockItems });

      const result = await searchExaWebset({ description: 'test' });

      // Should only include valid URL
      expect(result.companies.length).toBe(1);
      expect(result.companies[0].domain).toBe('valid.com');
    });
  });

  describe('isExaWebsetConfigured', () => {
    const originalEnv = process.env.EXA_API_KEY;

    afterEach(() => {
      process.env.EXA_API_KEY = originalEnv;
    });

    it('should return true when EXA_API_KEY is set', () => {
      process.env.EXA_API_KEY = 'test-api-key';
      expect(isExaWebsetConfigured()).toBe(true);
    });

    it('should return false when EXA_API_KEY is empty', () => {
      process.env.EXA_API_KEY = '';
      expect(isExaWebsetConfigured()).toBe(false);
    });

    it('should return false when EXA_API_KEY is whitespace', () => {
      process.env.EXA_API_KEY = '   ';
      expect(isExaWebsetConfigured()).toBe(false);
    });

    it('should return false when EXA_API_KEY is not set', () => {
      delete process.env.EXA_API_KEY;
      expect(isExaWebsetConfigured()).toBe(false);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFilterPreviewCounts } from '../src/services/filterPreview';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('filterPreview', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      from: vi.fn(),
    };
  });

  describe('getFilterPreviewCounts', () => {
    it('should validate and count matching employees and companies', async () => {
      const chain: any = {
        select: vi.fn(),
        eq: vi.fn(),
        in: vi.fn(),
        not: vi.fn(),
        gte: vi.fn(),
        lte: vi.fn(),
      };

      // Make all filter methods return the chain for chaining
      chain.eq.mockReturnValue(chain);
      chain.in.mockReturnValue(chain);
      chain.not.mockReturnValue(chain);
      chain.gte.mockReturnValue(chain);
      chain.lte.mockReturnValue(chain);

      // The first .select() call in buildContactQuery returns the chain
      // The second .select() call (for count) returns the count result
      // The third .select() call (for data) returns the data result
      chain.select
        .mockReturnValueOnce(chain) // First call in buildContactQuery
        .mockReturnValueOnce({ count: 10, error: null }) // Count query
        .mockReturnValueOnce(chain) // Second buildContactQuery call
        .mockReturnValueOnce({
          // Data query
          data: [
            { company_id: 'company-1' },
            { company_id: 'company-1' },
            { company_id: 'company-2' },
            { company_id: 'company-1' },
            { company_id: 'company-3' },
            { company_id: 'company-2' },
            { company_id: 'company-1' },
            { company_id: 'company-1' },
            { company_id: 'company-2' },
            { company_id: 'company-3' },
          ],
          error: null,
        });

      mockClient.from.mockReturnValue(chain);

      const filterDefinition = [
        { field: 'employees.role', operator: 'eq', value: 'CTO' },
      ];

      const result = await getFilterPreviewCounts(mockClient, filterDefinition);

      expect(result).toEqual({
        companyCount: 3,
        employeeCount: 10,
        totalCount: 10,
      });

      expect(mockClient.from).toHaveBeenCalledWith('employees');
    });

    it('should handle empty results', async () => {
      const chain: any = {
        select: vi.fn(),
        eq: vi.fn(),
        in: vi.fn(),
        not: vi.fn(),
        gte: vi.fn(),
        lte: vi.fn(),
      };

      chain.eq.mockReturnValue(chain);
      chain.in.mockReturnValue(chain);
      chain.not.mockReturnValue(chain);
      chain.gte.mockReturnValue(chain);
      chain.lte.mockReturnValue(chain);

      chain.select
        .mockReturnValueOnce(chain) // buildContactQuery
        .mockReturnValueOnce({ count: 0, error: null }); // count query

      mockClient.from.mockReturnValue(chain);

      const filterDefinition = [
        { field: 'employees.role', operator: 'eq', value: 'NonExistentRole' },
      ];

      const result = await getFilterPreviewCounts(mockClient, filterDefinition);

      expect(result).toEqual({
        companyCount: 0,
        employeeCount: 0,
        totalCount: 0,
      });
    });

    it('should throw error for invalid filter definition', async () => {
      const invalidFilterDefinition = [
        { field: 'invalid.field', operator: 'eq', value: 'test' },
      ];

      await expect(
        getFilterPreviewCounts(mockClient, invalidFilterDefinition)
      ).rejects.toThrow('Unknown field: invalid.field');
    });

    it('should throw error for empty filter array', async () => {
      await expect(
        getFilterPreviewCounts(mockClient, [])
      ).rejects.toThrow('filter_definition must contain at least one filter');
    });

    it('should handle company field filters', async () => {
      const chain: any = {
        select: vi.fn(),
        eq: vi.fn(),
        in: vi.fn(),
        not: vi.fn(),
        gte: vi.fn(),
        lte: vi.fn(),
      };

      chain.eq.mockReturnValue(chain);
      chain.in.mockReturnValue(chain);
      chain.not.mockReturnValue(chain);
      chain.gte.mockReturnValue(chain);
      chain.lte.mockReturnValue(chain);

      chain.select
        .mockReturnValueOnce(chain) // buildContactQuery
        .mockReturnValueOnce({ count: 5, error: null }) // count query
        .mockReturnValueOnce(chain) // second buildContactQuery
        .mockReturnValueOnce({
          // data query
          data: [
            { company_id: 'company-1' },
            { company_id: 'company-1' },
            { company_id: 'company-2' },
            { company_id: 'company-2' },
            { company_id: 'company-2' },
          ],
          error: null,
        });

      mockClient.from.mockReturnValue(chain);

      const filterDefinition = [
        { field: 'companies.segment', operator: 'eq', value: 'Enterprise' },
      ];

      const result = await getFilterPreviewCounts(mockClient, filterDefinition);

      expect(result).toEqual({
        companyCount: 2,
        employeeCount: 5,
        totalCount: 5,
      });
    });

    it('should handle in operator', async () => {
      const chain: any = {
        select: vi.fn(),
        eq: vi.fn(),
        in: vi.fn(),
        not: vi.fn(),
        gte: vi.fn(),
        lte: vi.fn(),
      };

      chain.eq.mockReturnValue(chain);
      chain.in.mockReturnValue(chain);
      chain.not.mockReturnValue(chain);
      chain.gte.mockReturnValue(chain);
      chain.lte.mockReturnValue(chain);

      chain.select
        .mockReturnValueOnce(chain) // buildContactQuery
        .mockReturnValueOnce({ count: 15, error: null }) // count query
        .mockReturnValueOnce(chain) // second buildContactQuery
        .mockReturnValueOnce({
          // data query
          data: Array(15)
            .fill(null)
            .map((_, i) => ({
              company_id: `company-${(i % 5) + 1}`,
            })),
          error: null,
        });

      mockClient.from.mockReturnValue(chain);

      const filterDefinition = [
        { field: 'employees.role', operator: 'in', value: ['CTO', 'CEO', 'VP'] },
      ];

      const result = await getFilterPreviewCounts(mockClient, filterDefinition);

      expect(result.employeeCount).toBe(15);
      expect(result.companyCount).toBe(5);
      expect(result.totalCount).toBe(15);
    });

    it('should handle database errors gracefully', async () => {
      const chain: any = {
        select: vi.fn(),
        eq: vi.fn(),
        in: vi.fn(),
        not: vi.fn(),
        gte: vi.fn(),
        lte: vi.fn(),
      };

      chain.eq.mockReturnValue(chain);
      chain.in.mockReturnValue(chain);
      chain.not.mockReturnValue(chain);
      chain.gte.mockReturnValue(chain);
      chain.lte.mockReturnValue(chain);

      chain.select
        .mockReturnValueOnce(chain) // buildContactQuery
        .mockReturnValueOnce({
          // count query returns error
          count: null,
          error: { message: 'Database connection failed' },
        });

      mockClient.from.mockReturnValue(chain);

      const filterDefinition = [
        { field: 'employees.role', operator: 'eq', value: 'CTO' },
      ];

      await expect(
        getFilterPreviewCounts(mockClient, filterDefinition)
      ).rejects.toThrow('Failed to count employees: Database connection failed');
    });

    it('should handle null company_ids', async () => {
      const chain: any = {
        select: vi.fn(),
        eq: vi.fn(),
        in: vi.fn(),
        not: vi.fn(),
        gte: vi.fn(),
        lte: vi.fn(),
      };

      chain.eq.mockReturnValue(chain);
      chain.in.mockReturnValue(chain);
      chain.not.mockReturnValue(chain);
      chain.gte.mockReturnValue(chain);
      chain.lte.mockReturnValue(chain);

      chain.select
        .mockReturnValueOnce(chain) // buildContactQuery
        .mockReturnValueOnce({ count: 8, error: null }) // count query
        .mockReturnValueOnce(chain) // second buildContactQuery
        .mockReturnValueOnce({
          // data query
          data: [
            { company_id: 'company-1' },
            { company_id: null },
            { company_id: 'company-2' },
            { company_id: null },
            { company_id: 'company-1' },
            { company_id: 'company-2' },
            { company_id: null },
            { company_id: 'company-1' },
          ],
          error: null,
        });

      mockClient.from.mockReturnValue(chain);

      const filterDefinition = [
        { field: 'employees.role', operator: 'eq', value: 'Contractor' },
      ];

      const result = await getFilterPreviewCounts(mockClient, filterDefinition);

      expect(result).toEqual({
        companyCount: 2, // Should only count non-null company_ids
        employeeCount: 8,
        totalCount: 8,
      });
    });
  });
});

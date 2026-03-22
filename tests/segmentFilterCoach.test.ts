import { describe, it, expect, beforeEach } from 'vitest';
import type { ChatClient, ChatMessage } from '../src/services/chatClient';
import { generateSegmentFiltersViaCoach } from '../src/services/icpCoach';
import type { FilterSuggestionRequest } from '../src/services/icpCoach';

class MockChatClient implements ChatClient {
  private mockResponse: string | null = null;

  setMockResponse(response: string) {
    this.mockResponse = response;
  }

  async complete(messages: ChatMessage[]): Promise<string> {
    void messages;
    if (!this.mockResponse) {
      throw new Error('Mock response not configured');
    }
    return this.mockResponse;
  }
}

describe('generateSegmentFiltersViaCoach', () => {
  let mockClient: MockChatClient;

  beforeEach(() => {
    mockClient = new MockChatClient();
  });

  describe('valid responses', () => {
    it('should generate single filter suggestion', async () => {
      const mockResponse = JSON.stringify({
        suggestions: [
          {
            filters: [
              { field: 'employees.role', operator: 'eq', value: 'CTO' },
              { field: 'companies.employee_count', operator: 'gte', value: 100 },
            ],
            rationale: 'Targets enterprise CTOs',
            targetAudience: 'Enterprise technology leaders',
          },
        ],
      });

      mockClient.setMockResponse(mockResponse);

      const request: FilterSuggestionRequest = {
        userDescription: 'Target enterprise CTOs',
        maxSuggestions: 1,
      };

      const result = await generateSegmentFiltersViaCoach(mockClient, request);

      expect(result).toHaveLength(1);
      expect(result[0].filters).toHaveLength(2);
      expect(result[0].filters[0]).toEqual({
        field: 'employees.role',
        operator: 'eq',
        value: 'CTO',
      });
      expect(result[0].rationale).toBe('Targets enterprise CTOs');
      expect(result[0].targetAudience).toBe('Enterprise technology leaders');
    });

    it('should generate multiple filter suggestions', async () => {
      const mockResponse = JSON.stringify({
        suggestions: [
          {
            filters: [{ field: 'employees.role', operator: 'in', value: ['CTO', 'VP Engineering'] }],
            rationale: 'Technical decision makers',
            targetAudience: 'C-level and VP-level tech leaders',
          },
          {
            filters: [
              { field: 'companies.industry', operator: 'eq', value: 'SaaS' },
              { field: 'companies.employee_count', operator: 'gte', value: 50 },
            ],
            rationale: 'Growing SaaS companies',
            targetAudience: 'Mid-market SaaS organizations',
          },
          {
            filters: [
              { field: 'employees.department', operator: 'eq', value: 'Engineering' },
              { field: 'employees.seniority', operator: 'in', value: ['Director', 'VP'] },
            ],
            rationale: 'Senior engineering leadership',
            targetAudience: 'Engineering directors and VPs',
          },
        ],
      });

      mockClient.setMockResponse(mockResponse);

      const request: FilterSuggestionRequest = {
        userDescription: 'Target tech leaders in growing SaaS companies',
      };

      const result = await generateSegmentFiltersViaCoach(mockClient, request);

      expect(result).toHaveLength(3);
      expect(result[0].filters[0].operator).toBe('in');
      expect(result[1].filters).toHaveLength(2);
      expect(result[2].targetAudience).toBe('Engineering directors and VPs');
    });

    it('should respect maxSuggestions parameter', async () => {
      const mockResponse = JSON.stringify({
        suggestions: [
          {
            filters: [{ field: 'employees.role', operator: 'eq', value: 'CTO' }],
            rationale: 'First suggestion',
          },
          {
            filters: [{ field: 'employees.role', operator: 'eq', value: 'VP Engineering' }],
            rationale: 'Second suggestion',
          },
          {
            filters: [{ field: 'employees.role', operator: 'eq', value: 'Director' }],
            rationale: 'Third suggestion',
          },
        ],
      });

      mockClient.setMockResponse(mockResponse);

      const request: FilterSuggestionRequest = {
        userDescription: 'Target tech leaders',
        maxSuggestions: 2,
      };

      const result = await generateSegmentFiltersViaCoach(mockClient, request);

      expect(result).toHaveLength(2);
    });

    it('should handle all valid operators', async () => {
      const mockResponse = JSON.stringify({
        suggestions: [
          {
            filters: [
              { field: 'employees.role', operator: 'eq', value: 'CTO' },
              { field: 'employees.department', operator: 'in', value: ['Engineering', 'Product'] },
              { field: 'employees.seniority', operator: 'not_in', value: ['Junior', 'Intern'] },
              { field: 'companies.employee_count', operator: 'gte', value: 100 },
              { field: 'companies.employee_count', operator: 'lte', value: 1000 },
            ],
            rationale: 'All operators test',
          },
        ],
      });

      mockClient.setMockResponse(mockResponse);

      const request: FilterSuggestionRequest = {
        userDescription: 'Test all operators',
      };

      const result = await generateSegmentFiltersViaCoach(mockClient, request);

      expect(result).toHaveLength(1);
      expect(result[0].filters).toHaveLength(5);
      expect(result[0].filters.map((f) => f.operator)).toEqual(['eq', 'in', 'not_in', 'gte', 'lte']);
    });

    it('should handle optional rationale and targetAudience', async () => {
      const mockResponse = JSON.stringify({
        suggestions: [
          {
            filters: [{ field: 'employees.role', operator: 'eq', value: 'CTO' }],
          },
        ],
      });

      mockClient.setMockResponse(mockResponse);

      const request: FilterSuggestionRequest = {
        userDescription: 'Target CTOs',
      };

      const result = await generateSegmentFiltersViaCoach(mockClient, request);

      expect(result).toHaveLength(1);
      expect(result[0].rationale).toBeUndefined();
      expect(result[0].targetAudience).toBeUndefined();
    });

    it('should handle ICP context in request', async () => {
      const mockResponse = JSON.stringify({
        suggestions: [
          {
            filters: [{ field: 'companies.industry', operator: 'eq', value: 'FinTech' }],
            rationale: 'Aligned with ICP',
          },
        ],
      });

      mockClient.setMockResponse(mockResponse);

      const request: FilterSuggestionRequest = {
        userDescription: 'Target decision makers',
        icpProfileId: 'profile-123',
        icpContext: 'FinTech companies with 100+ employees',
      };

      const result = await generateSegmentFiltersViaCoach(mockClient, request);

      expect(result).toHaveLength(1);
      expect(result[0].filters[0].value).toBe('FinTech');
    });
  });

  describe('validation errors', () => {
    it('should reject invalid JSON response', async () => {
      mockClient.setMockResponse('not valid json');

      const request: FilterSuggestionRequest = {
        userDescription: 'Test',
      };

      await expect(generateSegmentFiltersViaCoach(mockClient, request)).rejects.toThrow(
        'ICP coach returned non-JSON response'
      );
    });

    it('should reject response without suggestions array', async () => {
      mockClient.setMockResponse(JSON.stringify({ filters: [] }));

      const request: FilterSuggestionRequest = {
        userDescription: 'Test',
      };

      await expect(generateSegmentFiltersViaCoach(mockClient, request)).rejects.toThrow(
        'Filter coach returned no suggestions'
      );
    });

    it('should reject empty suggestions array', async () => {
      mockClient.setMockResponse(JSON.stringify({ suggestions: [] }));

      const request: FilterSuggestionRequest = {
        userDescription: 'Test',
      };

      await expect(generateSegmentFiltersViaCoach(mockClient, request)).rejects.toThrow(
        'Filter coach returned no suggestions'
      );
    });

    it('should reject suggestion without filters', async () => {
      const mockResponse = JSON.stringify({
        suggestions: [
          {
            rationale: 'Missing filters',
          },
        ],
      });

      mockClient.setMockResponse(mockResponse);

      const request: FilterSuggestionRequest = {
        userDescription: 'Test',
      };

      await expect(generateSegmentFiltersViaCoach(mockClient, request)).rejects.toThrow(
        'Suggestion at index 0 has no filters'
      );
    });

    it('should reject suggestion with empty filters array', async () => {
      const mockResponse = JSON.stringify({
        suggestions: [
          {
            filters: [],
          },
        ],
      });

      mockClient.setMockResponse(mockResponse);

      const request: FilterSuggestionRequest = {
        userDescription: 'Test',
      };

      await expect(generateSegmentFiltersViaCoach(mockClient, request)).rejects.toThrow(
        'Suggestion at index 0 has no filters'
      );
    });

    it('should reject filter with invalid field prefix', async () => {
      const mockResponse = JSON.stringify({
        suggestions: [
          {
            filters: [{ field: 'invalid.field', operator: 'eq', value: 'test' }],
          },
        ],
      });

      mockClient.setMockResponse(mockResponse);

      const request: FilterSuggestionRequest = {
        userDescription: 'Test',
      };

      await expect(generateSegmentFiltersViaCoach(mockClient, request)).rejects.toThrow(
        'Invalid field "invalid.field" at suggestion 0, filter 0. Must start with employees. or companies.'
      );
    });

    it('should reject filter with invalid operator', async () => {
      const mockResponse = JSON.stringify({
        suggestions: [
          {
            filters: [{ field: 'employees.role', operator: 'contains', value: 'CTO' }],
          },
        ],
      });

      mockClient.setMockResponse(mockResponse);

      const request: FilterSuggestionRequest = {
        userDescription: 'Test',
      };

      await expect(generateSegmentFiltersViaCoach(mockClient, request)).rejects.toThrow(
        'Invalid operator "contains" at suggestion 0, filter 0'
      );
    });

    it('should reject in operator with non-array value', async () => {
      const mockResponse = JSON.stringify({
        suggestions: [
          {
            filters: [{ field: 'employees.role', operator: 'in', value: 'CTO' }],
          },
        ],
      });

      mockClient.setMockResponse(mockResponse);

      const request: FilterSuggestionRequest = {
        userDescription: 'Test',
      };

      await expect(generateSegmentFiltersViaCoach(mockClient, request)).rejects.toThrow(
        'Operator "in" requires array value at suggestion 0, filter 0'
      );
    });

    it('should reject not_in operator with non-array value', async () => {
      const mockResponse = JSON.stringify({
        suggestions: [
          {
            filters: [{ field: 'employees.role', operator: 'not_in', value: 'CTO' }],
          },
        ],
      });

      mockClient.setMockResponse(mockResponse);

      const request: FilterSuggestionRequest = {
        userDescription: 'Test',
      };

      await expect(generateSegmentFiltersViaCoach(mockClient, request)).rejects.toThrow(
        'Operator "not_in" requires array value at suggestion 0, filter 0'
      );
    });

    it('should reject gte operator with non-numeric value', async () => {
      const mockResponse = JSON.stringify({
        suggestions: [
          {
            filters: [{ field: 'companies.employee_count', operator: 'gte', value: 'not a number' }],
          },
        ],
      });

      mockClient.setMockResponse(mockResponse);

      const request: FilterSuggestionRequest = {
        userDescription: 'Test',
      };

      await expect(generateSegmentFiltersViaCoach(mockClient, request)).rejects.toThrow(
        'Operator "gte" requires numeric value at suggestion 0, filter 0'
      );
    });

    it('should reject lte operator with non-numeric value', async () => {
      const mockResponse = JSON.stringify({
        suggestions: [
          {
            filters: [{ field: 'companies.employee_count', operator: 'lte', value: 'not a number' }],
          },
        ],
      });

      mockClient.setMockResponse(mockResponse);

      const request: FilterSuggestionRequest = {
        userDescription: 'Test',
      };

      await expect(generateSegmentFiltersViaCoach(mockClient, request)).rejects.toThrow(
        'Operator "lte" requires numeric value at suggestion 0, filter 0'
      );
    });

    it('should reject filter missing required fields', async () => {
      const mockResponse = JSON.stringify({
        suggestions: [
          {
            filters: [{ field: 'employees.role' }],
          },
        ],
      });

      mockClient.setMockResponse(mockResponse);

      const request: FilterSuggestionRequest = {
        userDescription: 'Test',
      };

      await expect(generateSegmentFiltersViaCoach(mockClient, request)).rejects.toThrow(
        'Invalid filter at suggestion 0, filter 0'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle single filter in suggestion', async () => {
      const mockResponse = JSON.stringify({
        suggestions: [
          {
            filters: [{ field: 'employees.role', operator: 'eq', value: 'CTO' }],
          },
        ],
      });

      mockClient.setMockResponse(mockResponse);

      const request: FilterSuggestionRequest = {
        userDescription: 'Simple target',
      };

      const result = await generateSegmentFiltersViaCoach(mockClient, request);

      expect(result).toHaveLength(1);
      expect(result[0].filters).toHaveLength(1);
    });

    it('should handle complex nested array values', async () => {
      const mockResponse = JSON.stringify({
        suggestions: [
          {
            filters: [
              {
                field: 'employees.role',
                operator: 'in',
                value: ['CTO', 'VP Engineering', 'Head of Product', 'Engineering Director'],
              },
            ],
          },
        ],
      });

      mockClient.setMockResponse(mockResponse);

      const request: FilterSuggestionRequest = {
        userDescription: 'Multiple roles',
      };

      const result = await generateSegmentFiltersViaCoach(mockClient, request);

      expect(result[0].filters[0].value).toHaveLength(4);
    });

    it('should validate all suggestions even when maxSuggestions is set', async () => {
      const mockResponse = JSON.stringify({
        suggestions: [
          {
            filters: [{ field: 'employees.role', operator: 'eq', value: 'CTO' }],
          },
          {
            filters: [{ field: 'invalid.field', operator: 'eq', value: 'test' }],
          },
        ],
      });

      mockClient.setMockResponse(mockResponse);

      const request: FilterSuggestionRequest = {
        userDescription: 'Test validation',
        maxSuggestions: 1,
      };

      // Should fail validation even though we only want 1 suggestion
      await expect(generateSegmentFiltersViaCoach(mockClient, request)).rejects.toThrow(
        'Invalid field "invalid.field"'
      );
    });

    it('should handle both employees and companies fields', async () => {
      const mockResponse = JSON.stringify({
        suggestions: [
          {
            filters: [
              { field: 'employees.role', operator: 'eq', value: 'CTO' },
              { field: 'employees.seniority', operator: 'in', value: ['C-Level', 'VP'] },
              { field: 'companies.industry', operator: 'eq', value: 'SaaS' },
              { field: 'companies.employee_count', operator: 'gte', value: 100 },
            ],
          },
        ],
      });

      mockClient.setMockResponse(mockResponse);

      const request: FilterSuggestionRequest = {
        userDescription: 'Mixed filters',
      };

      const result = await generateSegmentFiltersViaCoach(mockClient, request);

      expect(result[0].filters).toHaveLength(4);
      const employeeFields = result[0].filters.filter((f) => f.field.startsWith('employees.'));
      const companyFields = result[0].filters.filter((f) => f.field.startsWith('companies.'));
      expect(employeeFields).toHaveLength(2);
      expect(companyFields).toHaveLength(2);
    });
  });
});

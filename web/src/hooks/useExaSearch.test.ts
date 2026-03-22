import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useExaSearch } from './useExaSearch';
import type { ExaWebsetSearchResult } from '../types/exaWebset';

describe('useExaSearch', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useExaSearch());

    expect(result.current.companies).toEqual([]);
    expect(result.current.employees).toEqual([]);
    expect(result.current.totalResults).toBe(0);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should set loading state during search', async () => {
    let resolveSearch: (value: any) => void;
    const searchPromise = new Promise((resolve) => {
      resolveSearch = resolve;
    });

    const mockResponse: ExaWebsetSearchResult = {
      companies: [],
      employees: [],
      totalResults: 0,
      query: 'test query',
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => searchPromise);

    const { result } = renderHook(() => useExaSearch());

    // Start search in act
    await act(async () => {
      result.current.search('test description');
      // Wait a microtask for loading to be set
      await Promise.resolve();
    });

    // Loading should be true now
    expect(result.current.loading).toBe(true);

    // Resolve the search
    await act(async () => {
      resolveSearch!({
        ok: true,
        json: async () => mockResponse,
      });
      await searchPromise;
    });

    // Loading should be false after completion
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should successfully fetch and update state with search results', async () => {
    const mockResponse: ExaWebsetSearchResult = {
      companies: [
        {
          name: 'Acme Corp',
          domain: 'acme.com',
          location: 'San Francisco, CA',
          industry: 'SaaS',
          size: '100-500',
          confidenceScore: 0.95,
          sourceUrl: 'https://acme.com',
        },
      ],
      employees: [
        {
          name: 'John Doe',
          role: 'CTO',
          title: 'Chief Technology Officer',
          companyName: 'Acme Corp',
          companyDomain: 'acme.com',
          email: 'john@acme.com',
          confidenceScore: 0.88,
          sourceUrl: 'https://linkedin.com/in/johndoe',
        },
      ],
      totalResults: 2,
      query: 'Find CTOs at SaaS companies',
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useExaSearch());

    await result.current.search('Find CTOs at SaaS companies', 50);

    await waitFor(() => {
      expect(result.current.companies).toHaveLength(1);
      expect(result.current.employees).toHaveLength(1);
      expect(result.current.totalResults).toBe(2);
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.companies[0].name).toBe('Acme Corp');
    expect(result.current.employees[0].name).toBe('John Doe');
  });

  it('should call API with correct request body', async () => {
    const mockResponse: ExaWebsetSearchResult = {
      companies: [],
      employees: [],
      totalResults: 0,
      query: 'test',
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useExaSearch());

    await result.current.search('Enterprise SaaS CTOs', 100);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/exa/search',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: 'Enterprise SaaS CTOs',
          maxResults: 100,
          includeCompanies: true,
          includeEmployees: true,
        }),
      })
    );
  });

  it('should use default maxResults of 50 when not provided', async () => {
    const mockResponse: ExaWebsetSearchResult = {
      companies: [],
      employees: [],
      totalResults: 0,
      query: 'test',
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useExaSearch());

    await result.current.search('test description');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/exa/search',
      expect.objectContaining({
        body: JSON.stringify({
          description: 'test description',
          maxResults: 50,
          includeCompanies: true,
          includeEmployees: true,
        }),
      })
    );
  });

  it('should handle empty search description', async () => {
    const { result } = renderHook(() => useExaSearch());

    await result.current.search('');

    await waitFor(() => {
      expect(result.current.error).toBe('Search description cannot be empty');
      expect(result.current.loading).toBe(false);
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should trim whitespace from search description', async () => {
    const mockResponse: ExaWebsetSearchResult = {
      companies: [],
      employees: [],
      totalResults: 0,
      query: 'test',
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useExaSearch());

    await result.current.search('  test description  ');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/exa/search',
      expect.objectContaining({
        body: JSON.stringify({
          description: 'test description',
          maxResults: 50,
          includeCompanies: true,
          includeEmployees: true,
        }),
      })
    );
  });

  it('should handle API error responses', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    });

    const { result } = renderHook(() => useExaSearch());

    await result.current.search('test query');

    await waitFor(() => {
      expect(result.current.error).toBe('API error 500: Internal server error');
      expect(result.current.companies).toEqual([]);
      expect(result.current.employees).toEqual([]);
      expect(result.current.totalResults).toBe(0);
      expect(result.current.loading).toBe(false);
    });
  });

  it('should handle API error without error body', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => {
        throw new Error('Parse error');
      },
    });

    const { result } = renderHook(() => useExaSearch());

    await result.current.search('test query');

    await waitFor(() => {
      expect(result.current.error).toBe('API error 404');
      expect(result.current.loading).toBe(false);
    });
  });

  it('should handle network errors', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useExaSearch());

    await result.current.search('test query');

    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
      expect(result.current.companies).toEqual([]);
      expect(result.current.employees).toEqual([]);
      expect(result.current.totalResults).toBe(0);
      expect(result.current.loading).toBe(false);
    });
  });

  it('should handle missing data gracefully', async () => {
    const mockResponse: ExaWebsetSearchResult = {
      companies: [],
      employees: [],
      totalResults: 0,
      query: 'test',
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useExaSearch());

    await result.current.search('test query');

    await waitFor(() => {
      expect(result.current.companies).toEqual([]);
      expect(result.current.employees).toEqual([]);
      expect(result.current.totalResults).toBe(0);
      expect(result.current.error).toBeNull();
    });
  });

  it('should clear all state when clear is called', async () => {
    const mockResponse: ExaWebsetSearchResult = {
      companies: [
        {
          name: 'Acme Corp',
          domain: 'acme.com',
        },
      ],
      employees: [
        {
          name: 'John Doe',
          role: 'CTO',
        },
      ],
      totalResults: 2,
      query: 'test',
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useExaSearch());

    // Perform search
    await result.current.search('test query');

    await waitFor(() => {
      expect(result.current.companies).toHaveLength(1);
      expect(result.current.employees).toHaveLength(1);
      expect(result.current.totalResults).toBe(2);
    });

    // Clear state
    result.current.clear();

    await waitFor(() => {
      expect(result.current.companies).toEqual([]);
      expect(result.current.employees).toEqual([]);
      expect(result.current.totalResults).toBe(0);
      expect(result.current.error).toBeNull();
    });
  });

  it('should not clear loading state when clear is called', async () => {
    const { result } = renderHook(() => useExaSearch());

    result.current.clear();

    expect(result.current.loading).toBe(false);
  });

  it('should maintain search function reference between renders', () => {
    const { result, rerender } = renderHook(() => useExaSearch());

    const firstSearchRef = result.current.search;
    rerender();
    const secondSearchRef = result.current.search;

    expect(firstSearchRef).toBe(secondSearchRef);
  });

  it('should maintain clear function reference between renders', () => {
    const { result, rerender } = renderHook(() => useExaSearch());

    const firstClearRef = result.current.clear;
    rerender();
    const secondClearRef = result.current.clear;

    expect(firstClearRef).toBe(secondClearRef);
  });

  it('should handle subsequent searches correctly', async () => {
    const mockResponse1: ExaWebsetSearchResult = {
      companies: [{ name: 'Company 1', domain: 'company1.com' }],
      employees: [],
      totalResults: 1,
      query: 'query1',
    };

    const mockResponse2: ExaWebsetSearchResult = {
      companies: [
        { name: 'Company 2', domain: 'company2.com' },
        { name: 'Company 3', domain: 'company3.com' },
      ],
      employees: [{ name: 'Employee 1', role: 'CEO' }],
      totalResults: 3,
      query: 'query2',
    };

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse1,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse2,
      });

    const { result } = renderHook(() => useExaSearch());

    // First search
    await result.current.search('query 1');

    await waitFor(() => {
      expect(result.current.companies).toHaveLength(1);
      expect(result.current.totalResults).toBe(1);
    });

    // Second search
    await result.current.search('query 2');

    await waitFor(() => {
      expect(result.current.companies).toHaveLength(2);
      expect(result.current.employees).toHaveLength(1);
      expect(result.current.totalResults).toBe(3);
    });
  });

  it('should handle null or undefined companies/employees in response', async () => {
    const mockResponse = {
      companies: null,
      employees: undefined,
      totalResults: 0,
      query: 'test',
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useExaSearch());

    await result.current.search('test query');

    await waitFor(() => {
      expect(result.current.companies).toEqual([]);
      expect(result.current.employees).toEqual([]);
      expect(result.current.totalResults).toBe(0);
      expect(result.current.error).toBeNull();
    });
  });
});

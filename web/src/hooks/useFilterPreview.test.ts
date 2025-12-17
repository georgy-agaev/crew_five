import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFilterPreview } from './useFilterPreview';
import type { FilterDefinition } from '../types/filters';

describe('useFilterPreview', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return zero counts when filterDefinition is null', () => {
    const { result } = renderHook(() => useFilterPreview(null));

    expect(result.current.companyCount).toBe(0);
    expect(result.current.employeeCount).toBe(0);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should return zero counts when filterDefinition is empty array', () => {
    const { result } = renderHook(() => useFilterPreview([]));

    expect(result.current.companyCount).toBe(0);
    expect(result.current.employeeCount).toBe(0);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should fetch preview counts successfully', async () => {
    const filters: FilterDefinition[] = [
      { field: 'companies.country', operator: 'eq', value: 'US' },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ companyCount: 100, employeeCount: 250, totalCount: 350 }),
    });

    const { result } = renderHook(() => useFilterPreview(filters));

    // Wait for debounce and API call to complete
    await waitFor(
      () => {
        expect(result.current.companyCount).toBe(100);
      },
      { timeout: 1000 }
    );

    expect(result.current.employeeCount).toBe(250);
    expect(result.current.totalCount).toBe(350);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/filters/preview',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filterDefinition: filters }),
      })
    );
  });

  it('should handle API errors gracefully', async () => {
    const filters: FilterDefinition[] = [
      { field: 'employees.invalid', operator: 'eq', value: 'test' },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid filter field' }),
    });

    const { result } = renderHook(() => useFilterPreview(filters));

    await waitFor(
      () => {
        expect(result.current.error).toBe('API error 400: Invalid filter field');
      },
      { timeout: 1000 }
    );

    expect(result.current.companyCount).toBe(0);
    expect(result.current.employeeCount).toBe(0);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.loading).toBe(false);
  });

  it('should handle network errors', async () => {
    const filters: FilterDefinition[] = [
      { field: 'companies.name', operator: 'eq', value: 'Acme' },
    ];

    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useFilterPreview(filters));

    await waitFor(
      () => {
        expect(result.current.error).toBe('Network error');
      },
      { timeout: 1000 }
    );

    expect(result.current.loading).toBe(false);
  });

  it('should handle empty API response gracefully', async () => {
    const filters: FilterDefinition[] = [
      { field: 'companies.country', operator: 'eq', value: 'XX' },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ companyCount: 0, employeeCount: 0, totalCount: 0 }),
    });

    const { result } = renderHook(() => useFilterPreview(filters));

    await waitFor(
      () => {
        expect(result.current.companyCount).toBe(0);
      },
      { timeout: 1000 }
    );

    expect(result.current.employeeCount).toBe(0);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should handle malformed API response', async () => {
    const filters: FilterDefinition[] = [
      { field: 'companies.name', operator: 'eq', value: 'Test' },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('Invalid JSON');
      },
    });

    const { result } = renderHook(() => useFilterPreview(filters));

    await waitFor(
      () => {
        expect(result.current.error).toBe('API error 500');
      },
      { timeout: 1000 }
    );

    expect(result.current.loading).toBe(false);
  });

  it('should handle multiple filter conditions', async () => {
    const filters: FilterDefinition[] = [
      { field: 'employees.role', operator: 'eq', value: 'CTO' },
      { field: 'companies.country', operator: 'in', value: ['US', 'CA'] },
      { field: 'companies.size', operator: 'gte', value: 50 },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ companyCount: 20, employeeCount: 45, totalCount: 65 }),
    });

    const { result } = renderHook(() => useFilterPreview(filters));

    await waitFor(
      () => {
        expect(result.current.companyCount).toBe(20);
      },
      { timeout: 1000 }
    );

    expect(result.current.employeeCount).toBe(45);
    expect(result.current.totalCount).toBe(65);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/filters/preview',
      expect.objectContaining({
        body: JSON.stringify({ filterDefinition: filters }),
      })
    );
  });

  it('should debounce filter changes', async () => {
    const filters: FilterDefinition[] = [
      { field: 'employees.role', operator: 'eq', value: 'CEO' },
    ];

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ companyCount: 10, employeeCount: 15, totalCount: 25 }),
    });

    const { result } = renderHook(() => useFilterPreview(filters));

    // Wait for the debounced API call to complete
    await waitFor(
      () => {
        expect(result.current.companyCount).toBe(10);
      },
      { timeout: 1000 }
    );

    // Verify API was called
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/filters/preview',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ filterDefinition: filters }),
      })
    );
  });

  it('should set loading state during fetch', async () => {
    const filters: FilterDefinition[] = [
      { field: 'companies.size', operator: 'gte', value: 100 },
    ];

    let resolveFetch: (value: any) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    (global.fetch as any).mockReturnValueOnce(fetchPromise);

    const { result } = renderHook(() => useFilterPreview(filters));

    // Wait for debounce to trigger fetch
    await waitFor(
      () => {
        expect(result.current.loading).toBe(true);
      },
      { timeout: 1000 }
    );

    // Resolve fetch
    resolveFetch!({
      ok: true,
      json: async () => ({ companyCount: 50, employeeCount: 200, totalCount: 250 }),
    });

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 1000 }
    );

    expect(result.current.companyCount).toBe(50);
  });
});

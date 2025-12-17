import { useState, useEffect } from 'react';
import { useDebounce } from 'use-debounce';
import type { FilterDefinition, FilterPreviewResult } from '../types/filters';

export interface UseFilterPreviewResult {
  companyCount: number;
  employeeCount: number;
  totalCount: number;
  loading: boolean;
  error: string | null;
}

const baseUrl = import.meta.env.VITE_API_BASE ?? '/api';

/**
 * Custom hook for previewing filter results with debouncing.
 *
 * @param filterDefinition - Array of filter definitions to preview
 * @returns Preview counts, loading state, and error if any
 *
 * @example
 * const { companyCount, employeeCount, totalCount, loading, error } = useFilterPreview(filters);
 */
export function useFilterPreview(
  filterDefinition: FilterDefinition[] | null
): UseFilterPreviewResult {
  const [companyCount, setCompanyCount] = useState<number>(0);
  const [employeeCount, setEmployeeCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce filter changes by 500ms
  const [debouncedFilterDefinition] = useDebounce(filterDefinition, 500);

  useEffect(() => {
    // Skip API call if no filters or empty array
    if (!debouncedFilterDefinition || debouncedFilterDefinition.length === 0) {
      setCompanyCount(0);
      setEmployeeCount(0);
      setTotalCount(0);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    const fetchPreview = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${baseUrl}/filters/preview`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ filterDefinition: debouncedFilterDefinition }),
          signal: controller.signal,
        });

        if (!response.ok) {
          let errorMessage = `API error ${response.status}`;
          try {
            const errBody = await response.json();
            if (errBody?.error) {
              errorMessage = `${errorMessage}: ${errBody.error}`;
            }
          } catch {
            // Ignore parse errors
          }
          throw new Error(errorMessage);
        }

        const result = await response.json() as FilterPreviewResult;

        if (isMounted) {
          setCompanyCount(result.companyCount);
          setEmployeeCount(result.employeeCount);
          setTotalCount(result.totalCount);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted && err instanceof Error && err.name !== 'AbortError') {
          const message = err?.message ?? 'Failed to fetch filter preview';
          setError(message);
          setCompanyCount(0);
          setEmployeeCount(0);
          setTotalCount(0);
          setLoading(false);
        }
      }
    };

    fetchPreview();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [debouncedFilterDefinition]);

  return {
    companyCount,
    employeeCount,
    totalCount,
    loading,
    error,
  };
}

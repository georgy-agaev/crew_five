import { useState, useCallback } from 'react';
import type {
  ExaCompanyResult,
  ExaEmployeeResult,
  ExaWebsetSearchResult,
} from '../types/exaWebset';

export interface UseExaSearchResult {
  companies: ExaCompanyResult[];
  employees: ExaEmployeeResult[];
  totalResults: number;
  loading: boolean;
  error: string | null;
  search: (description: string, maxResults?: number) => Promise<void>;
  clear: () => void;
}

const baseUrl = import.meta.env.VITE_API_BASE ?? '/api';

/**
 * Custom hook for EXA web search with state management.
 *
 * @returns Search state, results, and control functions
 *
 * @example
 * const { companies, employees, totalResults, loading, error, search, clear } = useExaSearch();
 *
 * // Trigger a search
 * await search('Find CTOs at enterprise SaaS companies in San Francisco', 50);
 *
 * // Clear results
 * clear();
 */
export function useExaSearch(): UseExaSearchResult {
  const [companies, setCompanies] = useState<ExaCompanyResult[]>([]);
  const [employees, setEmployees] = useState<ExaEmployeeResult[]>([]);
  const [totalResults, setTotalResults] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clear = useCallback(() => {
    setCompanies([]);
    setEmployees([]);
    setTotalResults(0);
    setError(null);
  }, []);

  const search = useCallback(
    async (description: string, maxResults?: number): Promise<void> => {
      // Validate input
      if (!description || description.trim().length === 0) {
        setError('Search description cannot be empty');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const controller = new AbortController();

      try {
        const requestBody = {
          description: description.trim(),
          maxResults: maxResults ?? 50,
          includeCompanies: true,
          includeEmployees: true,
        };

        const response = await fetch(`${baseUrl}/exa/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
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

        const result = await response.json() as ExaWebsetSearchResult;

        setCompanies(result.companies || []);
        setEmployees(result.employees || []);
        setTotalResults(result.totalResults || 0);
        setLoading(false);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          const message = err?.message ?? 'Failed to execute EXA search';
          setError(message);
          setCompanies([]);
          setEmployees([]);
          setTotalResults(0);
          setLoading(false);
        }
      }
    },
    []
  );

  return {
    companies,
    employees,
    totalResults,
    loading,
    error,
    search,
    clear,
  };
}

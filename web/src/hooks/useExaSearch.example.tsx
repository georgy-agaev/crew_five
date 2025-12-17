/**
 * Example usage of useExaSearch hook
 *
 * This file demonstrates how to integrate the useExaSearch hook
 * into React components for EXA-powered segment discovery.
 */

import { useState } from 'react';
import { useExaSearch } from './useExaSearch';

/**
 * Example 1: Basic Search Component
 *
 * Simple search interface with results display
 */
export function ExaSearchBasic() {
  const [searchQuery, setSearchQuery] = useState('');
  const { companies, employees, totalResults, loading, error, search, clear } = useExaSearch();

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      await search(searchQuery);
    }
  };

  return (
    <div className="p-4">
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Describe your ideal customer profile..."
          className="flex-1 px-3 py-2 border rounded"
          disabled={loading}
        />
        <button
          onClick={handleSearch}
          disabled={loading || !searchQuery.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
        <button
          onClick={clear}
          disabled={loading}
          className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
        >
          Clear
        </button>
      </div>

      {error && (
        <div className="p-3 mb-4 bg-red-100 text-red-700 rounded">
          Error: {error}
        </div>
      )}

      {totalResults > 0 && (
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Found {totalResults} results ({companies.length} companies, {employees.length} employees)
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="font-semibold mb-2">Companies</h3>
          {companies.map((company, idx) => (
            <div key={idx} className="p-3 mb-2 border rounded">
              <p className="font-medium">{company.name}</p>
              {company.domain && <p className="text-sm text-gray-600">{company.domain}</p>}
              {company.location && <p className="text-sm text-gray-500">{company.location}</p>}
              {company.industry && <p className="text-sm text-gray-500">{company.industry}</p>}
            </div>
          ))}
        </div>

        <div>
          <h3 className="font-semibold mb-2">Employees</h3>
          {employees.map((employee, idx) => (
            <div key={idx} className="p-3 mb-2 border rounded">
              <p className="font-medium">{employee.name}</p>
              {employee.role && <p className="text-sm text-gray-600">{employee.role}</p>}
              {employee.companyName && <p className="text-sm text-gray-500">{employee.companyName}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Example 2: Advanced Search with Custom Limit
 *
 * Search with configurable result limits and validation
 */
export function ExaSearchAdvanced() {
  const [description, setDescription] = useState('');
  const [maxResults, setMaxResults] = useState(50);
  const { companies, employees, totalResults, loading, error, search, clear } = useExaSearch();

  const handleSearch = async () => {
    if (!description.trim()) {
      alert('Please enter a search description');
      return;
    }

    if (maxResults < 1 || maxResults > 500) {
      alert('Max results must be between 1 and 500');
      return;
    }

    await search(description, maxResults);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">EXA Segment Discovery</h2>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">
            Search Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="E.g., Find CTOs at enterprise SaaS companies in San Francisco with 100-500 employees"
            className="w-full px-3 py-2 border rounded resize-y"
            rows={3}
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Max Results: {maxResults}
          </label>
          <input
            type="range"
            min="1"
            max="500"
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value))}
            className="w-full"
            disabled={loading}
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>1</span>
            <span>500</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSearch}
            disabled={loading || !description.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
          <button
            onClick={clear}
            disabled={loading}
            className="px-6 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear Results
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-800 font-medium">Search Error</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-2 text-gray-600">Searching EXA...</p>
        </div>
      )}

      {!loading && totalResults > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4 pb-2 border-b">
            <h3 className="text-lg font-semibold">
              Results ({totalResults} total)
            </h3>
            <div className="text-sm text-gray-600">
              {companies.length} companies • {employees.length} employees
            </div>
          </div>

          <div className="space-y-4">
            {companies.map((company, idx) => (
              <div key={idx} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg">{company.name}</h4>
                    <div className="mt-1 space-y-1 text-sm text-gray-600">
                      {company.domain && (
                        <p>
                          <span className="font-medium">Domain:</span> {company.domain}
                        </p>
                      )}
                      {company.location && (
                        <p>
                          <span className="font-medium">Location:</span> {company.location}
                        </p>
                      )}
                      {company.industry && (
                        <p>
                          <span className="font-medium">Industry:</span> {company.industry}
                        </p>
                      )}
                      {company.size && (
                        <p>
                          <span className="font-medium">Size:</span> {company.size}
                        </p>
                      )}
                    </div>
                  </div>
                  {company.confidenceScore !== undefined && (
                    <div className="ml-4 text-right">
                      <div className="text-xs text-gray-500">Confidence</div>
                      <div className="text-lg font-semibold text-blue-600">
                        {(company.confidenceScore * 100).toFixed(0)}%
                      </div>
                    </div>
                  )}
                </div>
                {company.sourceUrl && (
                  <a
                    href={company.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline mt-2 inline-block"
                  >
                    View Source
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Example 3: Integration with Segment Creation Workflow
 *
 * Shows how to use EXA search as part of a larger segment creation flow
 */
export function ExaSearchSegmentFlow() {
  const [step, setStep] = useState<'search' | 'review' | 'create'>('search');
  const [searchDescription, setSearchDescription] = useState('');
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const { companies, totalResults, loading, error, search, clear } = useExaSearch();

  const handleSearch = async () => {
    await search(searchDescription, 100);
    if (totalResults > 0) {
      setStep('review');
    }
  };

  const toggleCompany = (companyName: string) => {
    const newSelected = new Set(selectedCompanies);
    if (newSelected.has(companyName)) {
      newSelected.delete(companyName);
    } else {
      newSelected.add(companyName);
    }
    setSelectedCompanies(newSelected);
  };

  const handleCreateSegment = () => {
    // This would integrate with your segment creation API
    console.log('Creating segment with companies:', Array.from(selectedCompanies));
    setStep('create');
  };

  const resetFlow = () => {
    clear();
    setStep('search');
    setSearchDescription('');
    setSelectedCompanies(new Set());
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1 rounded ${step === 'search' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
            1. Search
          </div>
          <div className={`px-3 py-1 rounded ${step === 'review' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
            2. Review
          </div>
          <div className={`px-3 py-1 rounded ${step === 'create' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
            3. Create
          </div>
        </div>
      </div>

      {step === 'search' && (
        <div>
          <h2 className="text-xl font-bold mb-4">Search for Companies</h2>
          <div className="mb-4">
            <textarea
              value={searchDescription}
              onChange={(e) => setSearchDescription(e.target.value)}
              placeholder="Describe your target segment..."
              className="w-full px-3 py-2 border rounded"
              rows={3}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !searchDescription.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
          {error && <p className="mt-2 text-red-600">{error}</p>}
        </div>
      )}

      {step === 'review' && (
        <div>
          <h2 className="text-xl font-bold mb-4">Review Results</h2>
          <p className="mb-4 text-gray-600">
            Select companies to include in your segment ({selectedCompanies.size} selected)
          </p>
          <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
            {companies.map((company, idx) => (
              <div
                key={idx}
                className={`p-3 border rounded cursor-pointer ${
                  selectedCompanies.has(company.name) ? 'bg-blue-50 border-blue-500' : 'hover:bg-gray-50'
                }`}
                onClick={() => toggleCompany(company.name)}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedCompanies.has(company.name)}
                    onChange={() => {}}
                    className="h-4 w-4"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{company.name}</p>
                    {company.domain && <p className="text-sm text-gray-600">{company.domain}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateSegment}
              disabled={selectedCompanies.size === 0}
              className="px-6 py-2 bg-green-600 text-white rounded disabled:opacity-50"
            >
              Create Segment ({selectedCompanies.size})
            </button>
            <button
              onClick={resetFlow}
              className="px-6 py-2 bg-gray-200 rounded"
            >
              Start Over
            </button>
          </div>
        </div>
      )}

      {step === 'create' && (
        <div className="text-center py-8">
          <div className="text-green-600 text-5xl mb-4">✓</div>
          <h2 className="text-2xl font-bold mb-2">Segment Created!</h2>
          <p className="text-gray-600 mb-4">
            Successfully created segment with {selectedCompanies.size} companies
          </p>
          <button
            onClick={resetFlow}
            className="px-6 py-2 bg-blue-600 text-white rounded"
          >
            Create Another Segment
          </button>
        </div>
      )}
    </div>
  );
}

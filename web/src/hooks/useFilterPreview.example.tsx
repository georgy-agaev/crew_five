/**
 * Example usage of useFilterPreview hook
 *
 * This demonstrates how to use the hook in a React component
 * to preview filter results with real-time updates and debouncing.
 */

import { useState } from 'react';
import { useFilterPreview } from './useFilterPreview';
import type { FilterDefinition } from '../types/filters';

export function FilterPreviewExample() {
  const [filters, setFilters] = useState<FilterDefinition[]>([
    { field: 'companies.country', operator: 'eq', value: 'US' },
  ]);

  const { companyCount, employeeCount, totalCount, loading, error } = useFilterPreview(filters);

  const handleAddFilter = () => {
    setFilters([
      ...filters,
      { field: 'employees.role', operator: 'eq', value: 'CTO' },
    ]);
  };

  const handleClearFilters = () => {
    setFilters([]);
  };

  return (
    <div>
      <h2>Filter Preview</h2>

      <div>
        <button onClick={handleAddFilter}>Add Role Filter</button>
        <button onClick={handleClearFilters}>Clear Filters</button>
      </div>

      {loading && <div>Loading preview...</div>}

      {error && <div style={{ color: 'red' }}>Error: {error}</div>}

      {!loading && !error && (
        <div>
          <p>Companies: {companyCount}</p>
          <p>Employees: {employeeCount}</p>
          <p>Total Contacts: {totalCount}</p>
        </div>
      )}

      <pre>
        Current filters: {JSON.stringify(filters, null, 2)}
      </pre>
    </div>
  );
}

// Example with null filters (no preview)
export function NoFilterExample() {
  const { companyCount, employeeCount, totalCount, loading, error } = useFilterPreview(null);

  return (
    <div>
      <p>No filters applied</p>
      <p>Companies: {companyCount}</p> {/* Will be 0 */}
      <p>Loading: {loading ? 'Yes' : 'No'}</p> {/* Will be No */}
      <p>Error: {error ?? 'None'}</p> {/* Will be None */}
    </div>
  );
}

// Example with dynamic filters based on user input
export function DynamicFilterExample() {
  const [country, setCountry] = useState('US');
  const [role, setRole] = useState('CTO');

  const filters: FilterDefinition[] = [
    { field: 'companies.country', operator: 'eq', value: country },
    { field: 'employees.role', operator: 'eq', value: role },
  ];

  const preview = useFilterPreview(filters);

  return (
    <div>
      <h2>Dynamic Filter Preview</h2>

      <label>
        Country:
        <input value={country} onChange={(e) => setCountry(e.target.value)} />
      </label>

      <label>
        Role:
        <input value={role} onChange={(e) => setRole(e.target.value)} />
      </label>

      {preview.loading && <p>Updating preview...</p>}

      <div>
        <h3>Preview Results</h3>
        <p>Companies: {preview.companyCount}</p>
        <p>Employees: {preview.employeeCount}</p>
        <p>Total: {preview.totalCount}</p>
      </div>
    </div>
  );
}

/**
 * FilterRow Component Usage Example
 *
 * This file demonstrates how to use the FilterRow component in your application.
 * It's not imported anywhere - just for documentation purposes.
 */

import { useState } from 'react';
import { FilterRow } from './FilterRow';
import type { FilterDefinition } from '../types/filters';

export function FilterRowExample() {
  const [filters, setFilters] = useState<FilterDefinition[]>([
    { field: 'employees.role', operator: 'eq', value: 'CTO' },
    { field: 'companies.employee_count', operator: 'gte', value: 100 },
    { field: 'companies.industry', operator: 'in', value: ['SaaS', 'Technology'] },
  ]);

  const handleFilterChange = (index: number, newFilter: FilterDefinition) => {
    setFilters((prev) => prev.map((f, i) => (i === index ? newFilter : f)));
  };

  const handleFilterRemove = (index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddFilter = () => {
    setFilters((prev) => [
      ...prev,
      { field: '', operator: 'eq', value: '' },
    ]);
  };

  return (
    <div>
      <h2>Filter Builder</h2>

      <div style={{ marginBottom: '16px' }}>
        {filters.map((filter, index) => (
          <FilterRow
            key={index}
            filter={filter}
            onChange={(newFilter) => handleFilterChange(index, newFilter)}
            onRemove={() => handleFilterRemove(index)}
          />
        ))}
      </div>

      <button onClick={handleAddFilter}>Add Filter</button>

      <div style={{ marginTop: '24px' }}>
        <h3>Current Filters (JSON)</h3>
        <pre style={{ background: '#f5f5f5', padding: '12px', borderRadius: '8px' }}>
          {JSON.stringify(filters, null, 2)}
        </pre>
      </div>
    </div>
  );
}

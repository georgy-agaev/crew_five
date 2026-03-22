import { AIFilterSuggestions } from './AIFilterSuggestions';
import type { FilterDefinition } from '../types/filters';

/**
 * Example usage of AIFilterSuggestions component
 *
 * This file demonstrates how to use the AIFilterSuggestions component
 * in your application. Copy and adapt this pattern as needed.
 */

export function AIFilterSuggestionsExample() {
  // Example suggestion data
  const exampleSuggestions = [
    {
      id: 'suggestion-1',
      targetAudience: 'Enterprise CTOs',
      rationale: 'Target senior technical leaders at large companies with budget authority',
      filters: [
        { field: 'employees.role', operator: 'eq', value: 'CTO' },
        { field: 'companies.employee_count', operator: 'gte', value: 500 },
      ] as FilterDefinition[],
      preview: {
        companyCount: 120,
        employeeCount: 150,
        totalCount: 270,
      },
    },
    {
      id: 'suggestion-2',
      targetAudience: 'SaaS VP-Level Decision Makers',
      rationale: 'Focus on VP-level decision makers in the software industry',
      filters: [
        { field: 'employees.seniority', operator: 'eq', value: 'VP' },
        { field: 'companies.industry', operator: 'in', value: ['SaaS', 'Software'] },
      ] as FilterDefinition[],
      preview: {
        companyCount: 85,
        employeeCount: 95,
        totalCount: 180,
      },
    },
  ];

  const handleSelectSuggestion = (suggestion: { id: string; filters: FilterDefinition[] }) => {
    console.log('Selected suggestion:', suggestion);
    // In your app, you might:
    // - Apply the filters to your segment builder
    // - Navigate to a segment creation page with pre-filled filters
    // - Update your application state with the selected filters
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>AI Filter Suggestions Example</h1>

      {/* Example 1: With suggestions */}
      <section style={{ marginTop: '32px' }}>
        <h2>With Suggestions</h2>
        <AIFilterSuggestions
          suggestions={exampleSuggestions}
          onSelect={handleSelectSuggestion}
        />
      </section>

      {/* Example 2: Loading state */}
      <section style={{ marginTop: '48px' }}>
        <h2>Loading State</h2>
        <AIFilterSuggestions
          suggestions={[]}
          loading={true}
          onSelect={handleSelectSuggestion}
        />
      </section>

      {/* Example 3: Empty state */}
      <section style={{ marginTop: '48px' }}>
        <h2>Empty State</h2>
        <AIFilterSuggestions
          suggestions={[]}
          loading={false}
          onSelect={handleSelectSuggestion}
        />
      </section>

      {/* Example 4: Suggestion without preview data */}
      <section style={{ marginTop: '48px' }}>
        <h2>Without Preview Data</h2>
        <AIFilterSuggestions
          suggestions={[
            {
              id: 'no-preview',
              targetAudience: 'Marketing Leaders',
              rationale: 'Target marketing decision makers',
              filters: [
                { field: 'employees.department', operator: 'eq', value: 'Marketing' },
                { field: 'employees.seniority', operator: 'in', value: ['Director', 'VP', 'C-Level'] },
              ] as FilterDefinition[],
              // No preview data provided
            },
          ]}
          onSelect={handleSelectSuggestion}
        />
      </section>
    </div>
  );
}

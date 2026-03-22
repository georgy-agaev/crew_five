import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { AIFilterSuggestions } from './AIFilterSuggestions';
import type { FilterDefinition } from '../types/filters';

describe('AIFilterSuggestions', () => {
  const mockSuggestions = [
    {
      id: 'suggestion-1',
      targetAudience: 'Enterprise CTOs',
      rationale: 'Target senior technical leaders at large companies',
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
      targetAudience: 'SaaS VPs',
      rationale: 'Focus on VP-level decision makers in software industry',
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
    {
      id: 'suggestion-3',
      targetAudience: 'Growth Stage Founders',
      rationale: 'Target founders at companies with strong growth',
      filters: [
        { field: 'employees.role', operator: 'eq', value: 'Founder' },
        { field: 'companies.employee_count', operator: 'gte', value: 20 },
        { field: 'companies.employee_count', operator: 'lte', value: 200 },
      ] as FilterDefinition[],
      preview: {
        companyCount: 45,
        employeeCount: 52,
        totalCount: 97,
      },
    },
  ];

  it('renders loading state when loading is true', () => {
    const html = renderToString(
      <AIFilterSuggestions suggestions={[]} loading={true} onSelect={vi.fn()} />
    );

    expect(html).toContain('Generating AI suggestions');
  });

  it('renders empty state when no suggestions provided', () => {
    const html = renderToString(
      <AIFilterSuggestions suggestions={[]} loading={false} onSelect={vi.fn()} />
    );

    expect(html).toContain('No AI suggestions available');
    expect(html).toContain('Add filters manually or try a different search');
  });

  it('renders suggestions with all required information', () => {
    const html = renderToString(
      <AIFilterSuggestions suggestions={mockSuggestions} onSelect={vi.fn()} />
    );

    // Check that title is present
    expect(html).toContain('AI-Generated Suggestions');

    // Check that all suggestions are rendered
    expect(html).toContain('Enterprise CTOs');
    expect(html).toContain('SaaS VPs');
    expect(html).toContain('Growth Stage Founders');

    // Check rationale is displayed
    expect(html).toContain('Target senior technical leaders at large companies');

    // Check preview counts are displayed
    expect(html).toContain('120');
    expect(html).toContain('companies');
    expect(html).toContain('150');
    expect(html).toContain('employees');
  });

  it('formats filter display correctly', () => {
    const html = renderToString(
      <AIFilterSuggestions suggestions={mockSuggestions} onSelect={vi.fn()} />
    );

    // Check eq operator formatting
    expect(html).toContain('employees.role equals CTO');

    // Check gte operator formatting
    expect(html).toContain('companies.employee_count &gt;= 500');

    // Check in operator formatting with array values
    expect(html).toContain('companies.industry in list SaaS, Software');

    // Check lte operator formatting
    expect(html).toContain('companies.employee_count &lt;= 200');
  });

  it('limits display to 3 suggestions even if more are provided', () => {
    const manySuggestions = [
      ...mockSuggestions,
      {
        id: 'suggestion-4',
        targetAudience: 'Fourth Suggestion',
        filters: [{ field: 'test', operator: 'eq', value: 'test' }] as FilterDefinition[],
      },
      {
        id: 'suggestion-5',
        targetAudience: 'Fifth Suggestion',
        filters: [{ field: 'test', operator: 'eq', value: 'test' }] as FilterDefinition[],
      },
    ];

    const html = renderToString(
      <AIFilterSuggestions suggestions={manySuggestions} onSelect={vi.fn()} />
    );

    // Should only show first 3
    expect(html).toContain('Enterprise CTOs');
    expect(html).toContain('SaaS VPs');
    expect(html).toContain('Growth Stage Founders');
    expect(html).not.toContain('Fourth Suggestion');
    expect(html).not.toContain('Fifth Suggestion');
  });

  it('renders suggestion without optional fields', () => {
    const minimalSuggestion = [
      {
        id: 'minimal',
        filters: [{ field: 'test.field', operator: 'eq', value: 'value' }] as FilterDefinition[],
      },
    ];

    const html = renderToString(
      <AIFilterSuggestions suggestions={minimalSuggestion} onSelect={vi.fn()} />
    );

    // Should still render with just the filter
    expect(html).toContain('test.field equals value');
    expect(html).toContain('Select This Segment');
  });

  it('displays filter count correctly', () => {
    const html = renderToString(
      <AIFilterSuggestions suggestions={mockSuggestions} onSelect={vi.fn()} />
    );

    // Check that filter counts are displayed (React SSR adds HTML comments around dynamic values)
    expect(html).toMatch(/Filters \(<!--\s*-->2<!--\s*-->\)/);
    expect(html).toMatch(/Filters \(<!--\s*-->3<!--\s*-->\)/);
  });

  it('renders select button for each suggestion', () => {
    const html = renderToString(
      <AIFilterSuggestions suggestions={mockSuggestions} onSelect={vi.fn()} />
    );

    // Check that select buttons are present (one per suggestion, 3 total)
    const buttonMatches = html.match(/Select This Segment/g);
    expect(buttonMatches).toBeTruthy();
    expect(buttonMatches?.length).toBe(3);
  });
});

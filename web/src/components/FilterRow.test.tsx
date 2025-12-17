import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { FilterRow } from './FilterRow';
import type { FilterDefinition } from '../types/filters';

describe('FilterRow', () => {
  it('renders with text input for eq operator', () => {
    const filter: FilterDefinition = {
      field: 'employees.role',
      operator: 'eq',
      value: 'CTO',
    };
    const onChange = vi.fn();
    const onRemove = vi.fn();

    const html = renderToString(<FilterRow filter={filter} onChange={onChange} onRemove={onRemove} />);

    expect(html).toContain('value="employees.role"');
    expect(html).toContain('value="CTO"');
    expect(html).toContain('type="text"');
    expect(html).toContain('value="eq"');
  });

  it('renders with number input for gte operator', () => {
    const filter: FilterDefinition = {
      field: 'companies.employee_count',
      operator: 'gte',
      value: 100,
    };
    const onChange = vi.fn();
    const onRemove = vi.fn();

    const html = renderToString(<FilterRow filter={filter} onChange={onChange} onRemove={onRemove} />);

    expect(html).toContain('value="100"');
    expect(html).toContain('type="number"');
    expect(html).toContain('value="gte"');
  });

  it('renders with textarea for in operator', () => {
    const filter: FilterDefinition = {
      field: 'employees.department',
      operator: 'in',
      value: ['Engineering', 'Product'],
    };
    const onChange = vi.fn();
    const onRemove = vi.fn();

    const html = renderToString(<FilterRow filter={filter} onChange={onChange} onRemove={onRemove} />);

    expect(html).toContain('Engineering, Product');
    expect(html).toContain('<textarea');
    expect(html).toContain('value="in"');
  });

  it('renders with lte operator for numeric comparison', () => {
    const filter: FilterDefinition = {
      field: 'companies.revenue',
      operator: 'lte',
      value: 1000000,
    };
    const onChange = vi.fn();
    const onRemove = vi.fn();

    const html = renderToString(<FilterRow filter={filter} onChange={onChange} onRemove={onRemove} />);

    expect(html).toContain('value="1000000"');
    expect(html).toContain('type="number"');
    expect(html).toContain('value="lte"');
  });

  it('renders with not_in operator for exclusion lists', () => {
    const filter: FilterDefinition = {
      field: 'companies.industry',
      operator: 'not_in',
      value: ['Retail', 'Hospitality'],
    };
    const onChange = vi.fn();
    const onRemove = vi.fn();

    const html = renderToString(<FilterRow filter={filter} onChange={onChange} onRemove={onRemove} />);

    expect(html).toContain('Retail, Hospitality');
    expect(html).toContain('<textarea');
    expect(html).toContain('value="not_in"');
  });

  it('handles empty list values', () => {
    const filter: FilterDefinition = {
      field: 'employees.department',
      operator: 'in',
      value: [],
    };
    const onChange = vi.fn();
    const onRemove = vi.fn();

    const html = renderToString(<FilterRow filter={filter} onChange={onChange} onRemove={onRemove} />);

    expect(html).toContain('<textarea');
    expect(html).toContain('placeholder="value1, value2, value3"');
  });

  it('includes remove button with accessible label', () => {
    const filter: FilterDefinition = {
      field: 'employees.role',
      operator: 'eq',
      value: 'CTO',
    };
    const onChange = vi.fn();
    const onRemove = vi.fn();

    const html = renderToString(<FilterRow filter={filter} onChange={onChange} onRemove={onRemove} />);

    expect(html).toContain('aria-label="Remove filter"');
    expect(html).toContain('title="Remove filter"');
    expect(html).toContain('✕');
  });

  it('includes all operator options in select', () => {
    const filter: FilterDefinition = {
      field: 'employees.role',
      operator: 'eq',
      value: 'CTO',
    };
    const onChange = vi.fn();
    const onRemove = vi.fn();

    const html = renderToString(<FilterRow filter={filter} onChange={onChange} onRemove={onRemove} />);

    // Check all operator options are present (React adds selected="" to the selected option)
    expect(html).toContain('value="eq"');
    expect(html).toContain('>equals<');
    expect(html).toContain('value="in">in list');
    expect(html).toContain('value="not_in">not in list');
    expect(html).toContain('value="gte">greater than or equal');
    expect(html).toContain('value="lte">less than or equal');
  });

  it('includes datalist with field suggestions', () => {
    const filter: FilterDefinition = {
      field: 'employees.role',
      operator: 'eq',
      value: 'CTO',
    };
    const onChange = vi.fn();
    const onRemove = vi.fn();

    const html = renderToString(<FilterRow filter={filter} onChange={onChange} onRemove={onRemove} />);

    expect(html).toContain('list="field-suggestions"');
    expect(html).toContain('<datalist id="field-suggestions"');
    expect(html).toContain('value="employees.role"');
    expect(html).toContain('value="companies.industry"');
  });

  it('renders with correct field placeholder', () => {
    const filter: FilterDefinition = {
      field: '',
      operator: 'eq',
      value: '',
    };
    const onChange = vi.fn();
    const onRemove = vi.fn();

    const html = renderToString(<FilterRow filter={filter} onChange={onChange} onRemove={onRemove} />);

    expect(html).toContain('placeholder="Field (e.g., employees.role)"');
  });
});

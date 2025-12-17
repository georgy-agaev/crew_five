import type { FilterDefinition, FilterOperator } from '../types/filters';

interface FilterRowProps {
  filter: FilterDefinition;
  onChange: (filter: FilterDefinition) => void;
  onRemove: () => void;
}

// Common field suggestions for the filter builder
const SUGGESTED_FIELDS = [
  'employees.role',
  'employees.title',
  'employees.seniority',
  'employees.department',
  'companies.industry',
  'companies.size',
  'companies.employee_count',
  'companies.revenue',
  'companies.location',
  'companies.founded_year',
];

// Operator display labels
const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: 'equals',
  in: 'in list',
  not_in: 'not in list',
  gte: 'greater than or equal',
  lte: 'less than or equal',
};

// Operators that expect array values
const LIST_OPERATORS: FilterOperator[] = ['in', 'not_in'];

// Operators that expect numeric values
const NUMERIC_OPERATORS: FilterOperator[] = ['gte', 'lte'];

export function FilterRow({ filter, onChange, onRemove }: FilterRowProps) {
  const isListOperator = LIST_OPERATORS.includes(filter.operator);
  const isNumericOperator = NUMERIC_OPERATORS.includes(filter.operator);
  const hasError = filter.field && !filter.field.startsWith('employees.') && !filter.field.startsWith('companies.');

  const handleFieldChange = (field: string) => {
    onChange({ ...filter, field });
  };

  const handleOperatorChange = (operator: FilterOperator) => {
    // Reset value when changing operator types
    let newValue: unknown = '';
    if (LIST_OPERATORS.includes(operator)) {
      newValue = [];
    } else if (NUMERIC_OPERATORS.includes(operator)) {
      newValue = 0;
    }
    onChange({ ...filter, operator, value: newValue });
  };

  const handleValueChange = (value: unknown) => {
    onChange({ ...filter, value });
  };

  const handleListValueChange = (textValue: string) => {
    // Parse comma-separated values into array
    const items = textValue
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    handleValueChange(items);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle keyboard shortcuts
    if (e.key === 'Escape') {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
  };

  const renderValueInput = () => {
    if (isListOperator) {
      // Render textarea for list values
      const arrayValue = Array.isArray(filter.value) ? filter.value : [];
      const textValue = arrayValue.join(', ');

      return (
        <textarea
          placeholder="value1, value2, value3"
          value={textValue}
          onChange={(e) => handleListValueChange(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            minHeight: '38px',
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
          rows={1}
          aria-label={`Filter value for ${filter.field || 'field'} (comma-separated list)`}
          aria-describedby={filter.field ? `filter-field-${filter.field}` : undefined}
        />
      );
    }

    if (isNumericOperator) {
      // Render number input for numeric operators
      const numValue = typeof filter.value === 'number' ? filter.value : 0;

      return (
        <input
          type="number"
          placeholder="0"
          value={numValue}
          onChange={(e) => handleValueChange(Number(e.target.value))}
          onKeyDown={handleKeyDown}
          aria-label={`Filter value for ${filter.field || 'field'} (numeric)`}
          aria-describedby={filter.field ? `filter-field-${filter.field}` : undefined}
        />
      );
    }

    // Default: text input for 'eq'
    const stringValue = typeof filter.value === 'string' ? filter.value : '';

    return (
      <input
        type="text"
        placeholder="value"
        value={stringValue}
        onChange={(e) => handleValueChange(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label={`Filter value for ${filter.field || 'field'}`}
        aria-describedby={filter.field ? `filter-field-${filter.field}` : undefined}
      />
    );
  };

  return (
    <div
      role="group"
      aria-label="Filter definition"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1.5fr auto',
        gap: '12px',
        alignItems: 'start',
        padding: '12px',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        marginBottom: '8px',
      }}
    >
      {/* Field selector with datalist for suggestions */}
      <div>
        <input
          list="field-suggestions"
          type="text"
          placeholder="Field (e.g., employees.role)"
          value={filter.field}
          onChange={(e) => handleFieldChange(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ margin: 0 }}
          aria-label="Filter field"
          aria-describedby="field-help"
          aria-invalid={hasError ? 'true' : 'false'}
          aria-required="true"
          id={filter.field ? `filter-field-${filter.field}` : undefined}
        />
        <datalist id="field-suggestions">
          {SUGGESTED_FIELDS.map((field) => (
            <option key={field} value={field} />
          ))}
        </datalist>
        <span id="field-help" style={{ display: 'none' }}>
          Enter a field starting with employees. or companies.
        </span>
      </div>

      {/* Operator dropdown */}
      <div>
        <select
          value={filter.operator}
          onChange={(e) => handleOperatorChange(e.target.value as FilterOperator)}
          onKeyDown={handleKeyDown}
          style={{ margin: 0 }}
          aria-label="Filter operator"
          aria-required="true"
        >
          {Object.entries(OPERATOR_LABELS).map(([op, label]) => (
            <option key={op} value={op}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Value input (varies by operator type) */}
      <div>{renderValueInput()}</div>

      {/* Remove button */}
      <div>
        <button
          type="button"
          onClick={onRemove}
          onKeyDown={handleKeyDown}
          className="ghost"
          style={{
            padding: '10px 12px',
            margin: 0,
            minWidth: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Remove filter"
          title="Remove filter"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

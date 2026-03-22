import type { FilterDefinition } from '../types/filters';

export interface AIFilterSuggestionsProps {
  suggestions: Array<{
    id: string;
    filters: FilterDefinition[];
    rationale?: string;
    targetAudience?: string;
    preview?: {
      companyCount: number;
      employeeCount: number;
      totalCount: number;
    };
  }>;
  loading?: boolean;
  onSelect: (suggestion: { id: string; filters: FilterDefinition[] }) => void;
}

// Operator display labels
const OPERATOR_LABELS: Record<string, string> = {
  eq: 'equals',
  in: 'in list',
  not_in: 'not in list',
  gte: '>=',
  lte: '<=',
};

/**
 * Format a single filter for human-readable display
 * e.g., "employees.role equals CTO"
 * e.g., "companies.employee_count >= 100"
 */
function formatFilterForDisplay(filter: FilterDefinition): string {
  const operatorLabel = OPERATOR_LABELS[filter.operator] || filter.operator;

  // Format the value based on type
  let valueDisplay: string;
  if (Array.isArray(filter.value)) {
    valueDisplay = filter.value.join(', ');
  } else if (typeof filter.value === 'string') {
    valueDisplay = filter.value;
  } else if (typeof filter.value === 'number') {
    valueDisplay = String(filter.value);
  } else {
    valueDisplay = JSON.stringify(filter.value);
  }

  return `${filter.field} ${operatorLabel} ${valueDisplay}`;
}

export function AIFilterSuggestions({
  suggestions,
  loading = false,
  onSelect,
}: AIFilterSuggestionsProps) {
  // Loading state
  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        style={{
          padding: '40px',
          textAlign: 'center',
          background: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div
          style={{
            fontSize: '14px',
            color: '#475569',
            fontWeight: 600,
            display: 'inline-block',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        >
          Generating AI suggestions...
        </div>
      </div>
    );
  }

  // Empty state
  if (!suggestions || suggestions.length === 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          padding: '40px',
          textAlign: 'center',
          background: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
          No AI suggestions available
        </div>
        <div style={{ fontSize: '13px', color: '#94a3b8' }}>
          Add filters manually or try a different search
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3
        style={{
          fontSize: '16px',
          fontWeight: 700,
          marginBottom: '16px',
          color: '#0f172a',
        }}
      >
        AI-Generated Suggestions
      </h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        {suggestions.slice(0, 3).map((suggestion) => (
          <div
            key={suggestion.id}
            className="card"
            style={{
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              cursor: 'pointer',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 25px 45px rgba(15, 23, 42, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 20px 35px rgba(15, 23, 42, 0.05)';
            }}
          >
            {/* Target Audience Label */}
            {suggestion.targetAudience && (
              <div
                className="pill pill--accent"
                style={{
                  marginBottom: '12px',
                  display: 'inline-flex',
                }}
              >
                {suggestion.targetAudience}
              </div>
            )}

            {/* Rationale */}
            {suggestion.rationale && (
              <div
                style={{
                  fontSize: '14px',
                  color: '#475569',
                  marginBottom: '16px',
                  lineHeight: '1.5',
                }}
              >
                {suggestion.rationale}
              </div>
            )}

            {/* Filter Details */}
            <div
              style={{
                background: '#f8fafc',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#64748b',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Filters ({suggestion.filters.length})
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                {suggestion.filters.map((filter, index) => (
                  <div
                    key={index}
                    style={{
                      fontSize: '13px',
                      color: '#0f172a',
                      fontFamily: 'monospace',
                      background: '#fff',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    {formatFilterForDisplay(filter)}
                  </div>
                ))}
              </div>
            </div>

            {/* Preview Counts */}
            {suggestion.preview && (
              <div
                style={{
                  fontSize: '13px',
                  color: '#0f172a',
                  marginBottom: '16px',
                  background: '#ecfdf5',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '10px 12px',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                  Preview Matches
                </div>
                <div style={{ color: '#065f46' }}>
                  <strong>{suggestion.preview.companyCount}</strong> companies,{' '}
                  <strong>{suggestion.preview.employeeCount}</strong> employees
                  <div style={{ fontSize: '12px', marginTop: '2px' }}>
                    ({suggestion.preview.totalCount} total contacts)
                  </div>
                </div>
              </div>
            )}

            {/* Select Button */}
            <button
              type="button"
              onClick={() =>
                onSelect({ id: suggestion.id, filters: suggestion.filters })
              }
              style={{
                width: '100%',
                margin: 0,
              }}
              aria-label={`Select suggestion: ${suggestion.targetAudience || 'segment'} with ${suggestion.filters.length} filters`}
            >
              Select This Segment
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

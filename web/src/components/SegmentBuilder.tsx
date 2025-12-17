import { useState, useRef, useEffect } from 'react';
import type { FilterDefinition } from '../types/filters';
import { FilterRow } from './FilterRow';
import { useFilterPreview } from '../hooks/useFilterPreview';
import { aiSuggestFiltersAPI } from '../apiClient';
import { AIFilterSuggestions } from './AIFilterSuggestions';

export interface SegmentBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (segment: { name: string; filterDefinition: FilterDefinition[] }) => Promise<void>;
}

export function SegmentBuilder({ isOpen, onClose, onCreate }: SegmentBuilderProps) {
  const [segmentName, setSegmentName] = useState('');
  const [filters, setFilters] = useState<FilterDefinition[]>([
    { field: '', operator: 'eq', value: '' },
  ]);
  const [creating, setCreating] = useState(false);

  // AI-assisted filter generation state
  const [aiDescription, setAiDescription] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<Array<{id: string; filters: FilterDefinition[]; rationale?: string; targetAudience?: string}>>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Validation state
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);

  // Get live preview of filter results
  const { companyCount, employeeCount, totalCount, loading: previewLoading, error: previewError } =
    useFilterPreview(filters);

  // Focus management refs
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLInputElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus management on modal open/close
  useEffect(() => {
    if (isOpen) {
      // Save currently focused element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Focus first input when modal opens
      setTimeout(() => {
        firstFocusableRef.current?.focus();
      }, 100);
    } else {
      // Restore focus when modal closes
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }
  }, [isOpen]);

  // Trap focus within modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  // Validation helper functions
  const validateFilters = (filtersToValidate: FilterDefinition[]): string[] => {
    const errors: string[] = [];
    const validFilters = filtersToValidate.filter(f => f.field.trim() !== '');

    if (validFilters.length === 0) {
      return errors; // No errors if no filters yet
    }

    // Check for duplicate filters (same field + operator combination)
    const filterKeys = new Set<string>();
    validFilters.forEach((filter) => {
      const key = `${filter.field}:${filter.operator}`;
      if (filterKeys.has(key)) {
        errors.push(`Duplicate filter detected: ${filter.field} with ${filter.operator} operator`);
      }
      filterKeys.add(key);
    });

    // Check for invalid column references (basic validation)
    const allowedPrefixes = ['employees.', 'companies.'];
    validFilters.forEach((filter) => {
      const hasValidPrefix = allowedPrefixes.some(prefix => filter.field.startsWith(prefix));
      if (!hasValidPrefix) {
        errors.push(`Invalid field: ${filter.field}. Must start with "employees." or "companies."`);
      }
    });

    return errors;
  };

  const handleFilterChange = (index: number, updatedFilter: FilterDefinition) => {
    const newFilters = [...filters];
    newFilters[index] = updatedFilter;
    setFilters(newFilters);

    // Clear validation errors when user makes changes
    setValidationErrors([]);
    setCreateError(null);

    // Validate on change
    const errors = validateFilters(newFilters);
    setValidationErrors(errors);
  };

  const handleRemoveFilter = (index: number) => {
    if (filters.length === 1) {
      // Don't remove the last filter, just reset it
      setFilters([{ field: '', operator: 'eq', value: '' }]);
    } else {
      setFilters(filters.filter((_, i) => i !== index));
    }
  };

  const handleAddFilter = () => {
    setFilters([...filters, { field: '', operator: 'eq', value: '' }]);
  };

  const handleCreate = async () => {
    setCreateError(null);
    setValidationErrors([]);

    if (!segmentName.trim()) {
      setCreateError('Segment name is required');
      return;
    }

    // Filter out empty filters (where field is empty)
    const validFilters = filters.filter(f => f.field.trim() !== '');

    if (validFilters.length === 0) {
      setCreateError('At least one filter is required');
      return;
    }

    // Validate filters before creating
    const errors = validateFilters(validFilters);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setCreateError('Please fix the validation errors before creating the segment');
      return;
    }

    // Check for zero matches (warning, not blocker)
    if (totalCount === 0 && !previewLoading && !previewError) {
      setCreateError('Warning: No contacts match these filters. The segment will be empty.');
      // Allow creation to proceed, but show warning
    }

    setCreating(true);
    try {
      await onCreate({ name: segmentName.trim(), filterDefinition: validFilters });
      // Reset form after successful creation
      setSegmentName('');
      setFilters([{ field: '', operator: 'eq', value: '' }]);
      setValidationErrors([]);
      setCreateError(null);
      onClose();
    } catch (error) {
      // Display user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Failed to create segment';
      setCreateError(errorMessage);
      console.error('Failed to create segment:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = () => {
    // Reset form
    setSegmentName('');
    setFilters([{ field: '', operator: 'eq', value: '' }]);
    setAiDescription('');
    setAiSuggestions([]);
    setAiError(null);
    setValidationErrors([]);
    setCreateError(null);
    onClose();
  };

  const handleAIGenerate = async () => {
    if (!aiDescription.trim()) return;

    setAiLoading(true);
    setAiError(null);

    try {
      const result = await aiSuggestFiltersAPI({
        userDescription: aiDescription,
        maxSuggestions: 3,
      });

      // Add unique IDs to suggestions
      const suggestionsWithIds = result.suggestions.map((s, i) => ({
        ...s,
        id: `ai-suggestion-${Date.now()}-${i}`,
      }));

      setAiSuggestions(suggestionsWithIds);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Failed to generate suggestions');
    } finally {
      setAiLoading(false);
    }
  };

  const handleKeyDownInTextarea = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Allow Enter key to submit AI generation (Ctrl+Enter or Cmd+Enter)
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleAIGenerate();
    }
  };

  const handleSelectAISuggestion = (suggestion: {id: string; filters: FilterDefinition[]}) => {
    // Replace current filters with selected suggestion
    setFilters(suggestion.filters);
    // Clear AI suggestions after selection
    setAiSuggestions([]);
  };

  const validFilters = filters.filter(f => f.field.trim() !== '');
  const hasValidationErrors = validationErrors.length > 0;
  const canCreate = segmentName.trim() !== '' && validFilters.length > 0 && !creating && !hasValidationErrors;

  return (
    <>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={handleCancel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="segment-builder-title"
        aria-busy={creating || aiLoading}
      >
      <div
        ref={modalRef}
        style={{
          background: '#fff',
          borderRadius: '16px',
          width: '90%',
          maxWidth: '800px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 id="segment-builder-title" style={{ margin: 0 }}>Build Segment</h2>
          <button
            type="button"
            onClick={handleCancel}
            className="ghost"
            style={{
              padding: '8px 12px',
              margin: 0,
              minWidth: 'auto',
            }}
            aria-label="Close segment builder dialog"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: '24px',
            overflow: 'auto',
            flex: 1,
          }}
        >
          {/* Segment Name Input */}
          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="segment-name-input">
              Segment Name
              <input
                id="segment-name-input"
                ref={firstFocusableRef}
                type="text"
                placeholder="e.g., Enterprise CTOs"
                value={segmentName}
                onChange={(e) => setSegmentName(e.target.value)}
                aria-required="true"
                aria-invalid={!segmentName.trim() && createError !== null ? 'true' : 'false'}
                aria-describedby={createError ? "create-error" : undefined}
              />
            </label>
          </div>

          {/* AI-Assisted Section */}
          <div style={{marginBottom: '24px'}}>
            <label htmlFor="ai-description-input" style={{display: 'block', marginBottom: '8px', fontWeight: 600}}>
              AI-Assisted Filter Builder
            </label>
            <textarea
              id="ai-description-input"
              value={aiDescription}
              onChange={(e) => setAiDescription(e.target.value)}
              onKeyDown={handleKeyDownInTextarea}
              placeholder="Describe your target audience (e.g., 'Enterprise CTOs in SaaS companies with 100+ employees')"
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
              aria-label="Describe your target audience for AI suggestions"
              aria-describedby={aiError ? "ai-error" : "ai-help"}
            />
            <span id="ai-help" style={{ display: 'none' }}>
              Press Ctrl+Enter or Cmd+Enter to generate suggestions
            </span>
            <button
              type="button"
              onClick={handleAIGenerate}
              disabled={!aiDescription.trim() || aiLoading}
              style={{
                marginTop: '8px',
                padding: '10px 16px',
                background: aiLoading ? '#cbd5e1' : '#0f172a',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: aiLoading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              aria-busy={aiLoading}
              aria-live="polite"
              aria-label={aiLoading ? 'Generating AI suggestions' : 'Generate AI suggestions'}
            >
              {aiLoading && (
                <svg
                  style={{ animation: 'spin 1s linear infinite', width: '16px', height: '16px' }}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    style={{ opacity: 0.25 }}
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    style={{ opacity: 0.75 }}
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              <span>{aiLoading ? 'Generating...' : 'Generate Suggestions'}</span>
            </button>
            {aiError && (
              <div
                id="ai-error"
                role="alert"
                style={{marginTop: '8px', color: '#ef4444', fontSize: '13px'}}
                aria-live="assertive"
              >
                {aiError}
              </div>
            )}
          </div>

          {/* AI Suggestions Display */}
          {aiSuggestions.length > 0 && (
            <div
              style={{marginBottom: '24px'}}
              role="region"
              aria-label="AI-generated filter suggestions"
              aria-live="polite"
            >
              <AIFilterSuggestions
                suggestions={aiSuggestions}
                loading={false}
                onSelect={handleSelectAISuggestion}
              />
            </div>
          )}

          {/* Filter Rows Section */}
          <div style={{ marginBottom: '16px' }} role="region" aria-label="Filter definitions">
            <h3 id="filters-heading" style={{ marginBottom: '12px', fontSize: '16px' }}>Filters</h3>
            <div role="list" aria-labelledby="filters-heading">
              {filters.map((filter, idx) => (
                <div key={idx} role="listitem">
                  <FilterRow
                    filter={filter}
                    onChange={(updatedFilter) => handleFilterChange(idx, updatedFilter)}
                    onRemove={() => handleRemoveFilter(idx)}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleAddFilter}
              className="ghost"
              style={{ marginTop: '8px' }}
              aria-label="Add another filter"
            >
              + Add Filter
            </button>
          </div>

          {/* Preview Count Display */}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label="Filter preview results"
            style={{
              padding: '16px',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              marginTop: '16px',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '8px', color: '#0f172a' }}>
              Preview
            </div>
            {previewLoading ? (
              <div style={{ color: '#475569', fontSize: '14px' }} aria-busy="true">
                <span style={{ display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }}>
                  Loading preview...
                </span>
              </div>
            ) : previewError ? (
              <div className="alert alert--error" style={{ margin: 0 }} role="alert">
                {previewError}
              </div>
            ) : validFilters.length === 0 ? (
              <div style={{ color: '#475569', fontSize: '14px' }}>
                Add filters to see preview
              </div>
            ) : (
              <>
                <div style={{ fontSize: '14px', color: '#0f172a' }}>
                  Matches: <strong>{companyCount}</strong> companies, <strong>{employeeCount}</strong> employees (
                  <strong>{totalCount}</strong> total)
                </div>
                {totalCount === 0 && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      background: '#fef3c7',
                      color: '#92400e',
                      borderRadius: '6px',
                      fontSize: '13px',
                      border: '1px solid #fcd34d',
                    }}
                  >
                    Warning: No contacts match these filters
                  </div>
                )}
              </>
            )}
          </div>

          {/* Validation Errors Display */}
          {validationErrors.length > 0 && (
            <div
              role="alert"
              aria-live="assertive"
              style={{
                marginTop: '16px',
                padding: '12px 16px',
                background: '#fee2e2',
                color: '#991b1b',
                borderRadius: '12px',
                border: '1px solid #fca5a5',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '14px' }}>
                Validation Errors:
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
                {validationErrors.map((error, idx) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Creation Error Display */}
          {createError && (
            <div
              id="create-error"
              role="alert"
              aria-live={createError.startsWith('Warning:') ? 'polite' : 'assertive'}
              style={{
                marginTop: '16px',
                padding: '12px 16px',
                background: createError.startsWith('Warning:') ? '#fef3c7' : '#fee2e2',
                color: createError.startsWith('Warning:') ? '#92400e' : '#991b1b',
                borderRadius: '12px',
                border: createError.startsWith('Warning:') ? '1px solid #fcd34d' : '1px solid #fca5a5',
                fontSize: '14px',
              }}
            >
              {createError}
            </div>
          )}
        </div>

        {/* Footer / Action Buttons */}
        <div
          style={{
            padding: '24px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            type="button"
            onClick={handleCancel}
            className="ghost"
            disabled={creating}
            aria-label="Cancel segment creation"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCreate}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              justifyContent: 'center',
            }}
            aria-busy={creating}
            aria-label={creating ? 'Creating segment' : 'Create segment'}
          >
            {creating && (
              <svg
                style={{ animation: 'spin 1s linear infinite', width: '16px', height: '16px' }}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  style={{ opacity: 0.25 }}
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  style={{ opacity: 0.75 }}
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            <span>{creating ? 'Creating...' : 'Create Segment'}</span>
          </button>
        </div>
      </div>
      </div>
    </>
  );
}

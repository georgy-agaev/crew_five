import { useState } from 'react';
import type { FilterDefinition } from '../types/filters';
import { FilterRow } from './FilterRow';
import { useFilterPreview } from '../hooks/useFilterPreview';

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

  // Get live preview of filter results
  const { companyCount, employeeCount, totalCount, loading: previewLoading, error: previewError } =
    useFilterPreview(filters);

  if (!isOpen) {
    return null;
  }

  const handleFilterChange = (index: number, updatedFilter: FilterDefinition) => {
    const newFilters = [...filters];
    newFilters[index] = updatedFilter;
    setFilters(newFilters);
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
    if (!segmentName.trim()) {
      return;
    }

    // Filter out empty filters (where field is empty)
    const validFilters = filters.filter(f => f.field.trim() !== '');

    if (validFilters.length === 0) {
      return;
    }

    setCreating(true);
    try {
      await onCreate({ name: segmentName.trim(), filterDefinition: validFilters });
      // Reset form after successful creation
      setSegmentName('');
      setFilters([{ field: '', operator: 'eq', value: '' }]);
      onClose();
    } catch (error) {
      // Error handling is managed by parent
      console.error('Failed to create segment:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = () => {
    // Reset form
    setSegmentName('');
    setFilters([{ field: '', operator: 'eq', value: '' }]);
    onClose();
  };

  const validFilters = filters.filter(f => f.field.trim() !== '');
  const canCreate = segmentName.trim() !== '' && validFilters.length > 0 && !creating;

  return (
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
    >
      <div
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
          <h2 style={{ margin: 0 }}>Build Segment</h2>
          <button
            type="button"
            onClick={handleCancel}
            className="ghost"
            style={{
              padding: '8px 12px',
              margin: 0,
              minWidth: 'auto',
            }}
            aria-label="Close"
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
            <label>
              Segment Name
              <input
                type="text"
                placeholder="e.g., Enterprise CTOs"
                value={segmentName}
                onChange={(e) => setSegmentName(e.target.value)}
                autoFocus
              />
            </label>
          </div>

          {/* Filter Rows Section */}
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Filters</h3>
            {filters.map((filter, index) => (
              <FilterRow
                key={index}
                filter={filter}
                onChange={(updatedFilter) => handleFilterChange(index, updatedFilter)}
                onRemove={() => handleRemoveFilter(index)}
              />
            ))}
            <button
              type="button"
              onClick={handleAddFilter}
              className="ghost"
              style={{ marginTop: '8px' }}
            >
              + Add Filter
            </button>
          </div>

          {/* Preview Count Display */}
          <div
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
              <div style={{ color: '#475569', fontSize: '14px' }}>
                <span style={{ display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }}>
                  Loading preview...
                </span>
              </div>
            ) : previewError ? (
              <div className="alert alert--error" style={{ margin: 0 }}>
                {previewError}
              </div>
            ) : validFilters.length === 0 ? (
              <div style={{ color: '#475569', fontSize: '14px' }}>
                Add filters to see preview
              </div>
            ) : (
              <div style={{ fontSize: '14px', color: '#0f172a' }}>
                Matches: <strong>{companyCount}</strong> companies, <strong>{employeeCount}</strong> employees (
                <strong>{totalCount}</strong> total)
              </div>
            )}
          </div>
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
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCreate}
          >
            {creating ? 'Creating...' : 'Create Segment'}
          </button>
        </div>
      </div>
    </div>
  );
}

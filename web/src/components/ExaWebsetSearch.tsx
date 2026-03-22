import { useState, useRef, useEffect } from 'react';
import type { ExaCompanyResult, ExaEmployeeResult } from '../types/exaWebset';
import { useExaSearch } from '../hooks/useExaSearch';
import type { WorkspaceColors } from '../theme';
import { lightWorkspaceColors } from '../theme';

export interface ExaWebsetSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (segment: {
    name: string;
    companies: ExaCompanyResult[];
    employees: ExaEmployeeResult[];
    query: string;
  }) => Promise<void>;
  colors?: WorkspaceColors;
}

export function ExaWebsetSearch({ isOpen, onClose, onSave, colors }: ExaWebsetSearchProps) {
  const [searchDescription, setSearchDescription] = useState('');
  const [segmentName, setSegmentName] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'companies' | 'employees'>('companies');

  const { companies, employees, totalResults, loading, error, search, clear } = useExaSearch();

  // Focus management refs
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLTextAreaElement>(null);
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

  const hasSearched = companies.length > 0 || employees.length > 0;

  const handleSearch = async () => {
    if (!searchDescription.trim()) {
      return;
    }
    await search(searchDescription, 50);
  };

  const handleSave = async () => {
    if (!segmentName.trim() || !hasSearched) {
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: segmentName.trim(),
        companies,
        employees,
        query: searchDescription.trim(),
      });
      // Reset form after successful save
      setSearchDescription('');
      setSegmentName('');
      clear();
      onClose();
    } catch (error) {
      console.error('Failed to save segment:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSearchDescription('');
    setSegmentName('');
    clear();
    onClose();
  };

  const handleKeyDownInTextarea = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Allow Ctrl+Enter or Cmd+Enter to submit search
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSearch();
    }
  };

  const canSave = segmentName.trim() !== '' && hasSearched && !saving;

  const palette: WorkspaceColors = colors ?? lightWorkspaceColors;

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
        aria-labelledby="exa-search-title"
        aria-busy={loading || saving}
      >
      <div
        ref={modalRef}
        style={{
          background: '#fff',
          borderRadius: '16px',
          width: '90%',
          maxWidth: '900px',
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
            borderBottom: `1px solid ${palette.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 id="exa-search-title" style={{ margin: 0 }}>EXA Web Search</h2>
          <button
            type="button"
            onClick={handleCancel}
            className="ghost"
            style={{
              padding: '8px 12px',
              margin: 0,
              minWidth: 'auto',
            }}
            aria-label="Close EXA web search dialog"
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
          {/* Search Input Section */}
          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="exa-search-input" style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
              Search Description
            </label>
            <textarea
              id="exa-search-input"
              ref={firstFocusableRef}
              value={searchDescription}
              onChange={(e) => setSearchDescription(e.target.value)}
              onKeyDown={handleKeyDownInTextarea}
              placeholder="Describe the companies or people you want to find (e.g., 'CTOs at enterprise SaaS companies in San Francisco')"
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
              aria-label="Describe companies or people to search for"
              aria-describedby={error ? "search-error" : "search-help"}
              aria-required="true"
            />
            <span id="search-help" style={{ display: 'none' }}>
              Press Ctrl+Enter or Cmd+Enter to search
            </span>
            <button
              type="button"
              onClick={handleSearch}
              disabled={!searchDescription.trim() || loading}
              style={{
                marginTop: '12px',
                padding: '10px 16px',
                background: loading ? palette.border : palette.orange,
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              aria-busy={loading}
              aria-live="polite"
              aria-label={loading ? 'Searching EXA database' : 'Search EXA database'}
            >
              {loading && (
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
              <span>{loading ? 'Searching...' : 'Search'}</span>
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div
              id="search-error"
              role="alert"
              aria-live="assertive"
              style={{
                padding: '12px 16px',
                background: '#fee2e2',
                color: palette.error,
                borderRadius: '8px',
                marginBottom: '24px',
                fontSize: '14px',
              }}
            >
              {error}
            </div>
          )}

          {/* Results Section */}
          {hasSearched && (
            <>
              {/* Results Count */}
              <div
                role="status"
                aria-live="polite"
                style={{
                  padding: '16px',
                  background: palette.sidebar,
                  borderRadius: '12px',
                  border: `1px solid ${palette.border}`,
                  marginBottom: '24px',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '4px', color: palette.text }}>
                  Search Results
                </div>
                <div style={{ fontSize: '14px', color: palette.text }}>
                  Found: <strong>{companies.length}</strong> companies, <strong>{employees.length}</strong> employees (
                  <strong>{totalResults}</strong> total results)
                </div>
              </div>

              {/* Tabs */}
              <div
                role="tablist"
                aria-label="Search results by type"
                style={{
                  display: 'flex',
                  gap: '8px',
                  borderBottom: '2px solid #e2e8f0',
                  marginBottom: '16px',
                }}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'companies'}
                  aria-controls="companies-panel"
                  id="companies-tab"
                  onClick={() => setActiveTab('companies')}
                  style={{
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'companies' ? `2px solid ${palette.text}` : '2px solid transparent',
                    marginBottom: '-2px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: activeTab === 'companies' ? 600 : 400,
                    color: activeTab === 'companies' ? palette.text : palette.textMuted,
                  }}
                >
                  Companies ({companies.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'employees'}
                  aria-controls="employees-panel"
                  id="employees-tab"
                  onClick={() => setActiveTab('employees')}
                  style={{
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'employees' ? `2px solid ${palette.text}` : '2px solid transparent',
                    marginBottom: '-2px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: activeTab === 'employees' ? 600 : 400,
                    color: activeTab === 'employees' ? palette.text : palette.textMuted,
                  }}
                >
                  Employees ({employees.length})
                </button>
              </div>

              {/* Results Display */}
              <div
                role="tabpanel"
                id={`${activeTab}-panel`}
                aria-labelledby={`${activeTab}-tab`}
                style={{
                  maxHeight: '300px',
                  overflow: 'auto',
                  border: `1px solid ${palette.border}`,
                  borderRadius: '8px',
                  marginBottom: '24px',
                }}
              >
                {activeTab === 'companies' && (
                  <div>
                    {companies.length === 0 ? (
                      <div style={{ padding: '16px', color: palette.textMuted, textAlign: 'center' }}>
                        No companies found
                      </div>
                    ) : (
                      companies.map((company, index) => (
                        <div
                          key={index}
                          style={{
                            padding: '12px 16px',
                            borderBottom: index < companies.length - 1 ? `1px solid ${palette.border}` : 'none',
                          }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: '4px' }}>{company.name}</div>
                          <div style={{ fontSize: '13px', color: palette.textMuted }}>
                            {company.domain && <div>Domain: {company.domain}</div>}
                            {company.location && <div>Location: {company.location}</div>}
                            {company.industry && <div>Industry: {company.industry}</div>}
                            {company.size && <div>Size: {company.size}</div>}
                            {company.confidenceScore !== undefined && (
                              <div>Confidence: {Math.round(company.confidenceScore * 100)}%</div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'employees' && (
                  <div>
                    {employees.length === 0 ? (
                      <div style={{ padding: '16px', color: palette.textMuted, textAlign: 'center' }}>
                        No employees found
                      </div>
                    ) : (
                      employees.map((employee, index) => (
                        <div
                          key={index}
                          style={{
                            padding: '12px 16px',
                            borderBottom: index < employees.length - 1 ? `1px solid ${palette.border}` : 'none',
                          }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: '4px' }}>{employee.name}</div>
                          <div style={{ fontSize: '13px', color: palette.textMuted }}>
                            {employee.role && <div>Role: {employee.role}</div>}
                            {employee.title && <div>Title: {employee.title}</div>}
                            {employee.companyName && <div>Company: {employee.companyName}</div>}
                            {employee.companyDomain && <div>Domain: {employee.companyDomain}</div>}
                            {employee.location && <div>Location: {employee.location}</div>}
                            {employee.email && <div>Email: {employee.email}</div>}
                            {employee.confidenceScore !== undefined && (
                              <div>Confidence: {Math.round(employee.confidenceScore * 100)}%</div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Segment Name Input - Only show after search */}
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="exa-segment-name">
                  Segment Name
                  <input
                    id="exa-segment-name"
                    type="text"
                    placeholder="e.g., Enterprise CTOs from EXA Search"
                    value={segmentName}
                    onChange={(e) => setSegmentName(e.target.value)}
                    aria-required="true"
                    aria-invalid={hasSearched && !segmentName.trim() ? 'true' : 'false'}
                    aria-describedby="segment-name-help"
                  />
                </label>
                <span id="segment-name-help" style={{ display: 'none' }}>
                  Enter a name for this segment to save the search results
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer / Action Buttons */}
        <div
          style={{
            padding: '24px',
            borderTop: `1px solid ${palette.border}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            type="button"
            onClick={handleCancel}
            className="ghost"
            disabled={saving}
            aria-label="Cancel and close"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              justifyContent: 'center',
              background: palette.orange,
              borderColor: palette.orange,
              color: '#FFF',
              opacity: canSave ? 1 : 0.6,
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}
            aria-busy={saving}
            aria-label={saving ? 'Saving segment' : 'Save as segment'}
          >
            {saving && (
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
            <span>{saving ? 'Saving...' : 'Save as Segment'}</span>
          </button>
        </div>
      </div>
      </div>
    </>
  );
}

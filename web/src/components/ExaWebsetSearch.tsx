import { useState } from 'react';
import type { ExaCompanyResult, ExaEmployeeResult } from '../types/exaWebset';
import { useExaSearch } from '../hooks/useExaSearch';

export interface ExaWebsetSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (segment: {
    name: string;
    companies: ExaCompanyResult[];
    employees: ExaEmployeeResult[];
    query: string;
  }) => Promise<void>;
}

export function ExaWebsetSearch({ isOpen, onClose, onSave }: ExaWebsetSearchProps) {
  const [searchDescription, setSearchDescription] = useState('');
  const [segmentName, setSegmentName] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'companies' | 'employees'>('companies');

  const { companies, employees, totalResults, loading, error, search, clear } = useExaSearch();

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

  const canSave = segmentName.trim() !== '' && hasSearched && !saving;

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
      >
      <div
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
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0 }}>EXA Web Search</h2>
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
          {/* Search Input Section */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
              Search Description
            </label>
            <textarea
              value={searchDescription}
              onChange={(e) => setSearchDescription(e.target.value)}
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
              autoFocus
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={!searchDescription.trim() || loading}
              style={{
                marginTop: '12px',
                padding: '10px 16px',
                background: loading ? '#cbd5e1' : '#0f172a',
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
              style={{
                padding: '12px 16px',
                background: '#fee2e2',
                color: '#b91c1c',
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
                style={{
                  padding: '16px',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  marginBottom: '24px',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '4px', color: '#0f172a' }}>
                  Search Results
                </div>
                <div style={{ fontSize: '14px', color: '#0f172a' }}>
                  Found: <strong>{companies.length}</strong> companies, <strong>{employees.length}</strong> employees (
                  <strong>{totalResults}</strong> total results)
                </div>
              </div>

              {/* Tabs */}
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  borderBottom: '2px solid #e2e8f0',
                  marginBottom: '16px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('companies')}
                  style={{
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'companies' ? '2px solid #0f172a' : '2px solid transparent',
                    marginBottom: '-2px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: activeTab === 'companies' ? 600 : 400,
                    color: activeTab === 'companies' ? '#0f172a' : '#64748b',
                  }}
                >
                  Companies ({companies.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('employees')}
                  style={{
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'employees' ? '2px solid #0f172a' : '2px solid transparent',
                    marginBottom: '-2px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: activeTab === 'employees' ? 600 : 400,
                    color: activeTab === 'employees' ? '#0f172a' : '#64748b',
                  }}
                >
                  Employees ({employees.length})
                </button>
              </div>

              {/* Results Display */}
              <div
                style={{
                  maxHeight: '300px',
                  overflow: 'auto',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  marginBottom: '24px',
                }}
              >
                {activeTab === 'companies' && (
                  <div>
                    {companies.length === 0 ? (
                      <div style={{ padding: '16px', color: '#64748b', textAlign: 'center' }}>
                        No companies found
                      </div>
                    ) : (
                      companies.map((company, index) => (
                        <div
                          key={index}
                          style={{
                            padding: '12px 16px',
                            borderBottom: index < companies.length - 1 ? '1px solid #e2e8f0' : 'none',
                          }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: '4px' }}>{company.name}</div>
                          <div style={{ fontSize: '13px', color: '#64748b' }}>
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
                      <div style={{ padding: '16px', color: '#64748b', textAlign: 'center' }}>
                        No employees found
                      </div>
                    ) : (
                      employees.map((employee, index) => (
                        <div
                          key={index}
                          style={{
                            padding: '12px 16px',
                            borderBottom: index < employees.length - 1 ? '1px solid #e2e8f0' : 'none',
                          }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: '4px' }}>{employee.name}</div>
                          <div style={{ fontSize: '13px', color: '#64748b' }}>
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
                <label>
                  Segment Name
                  <input
                    type="text"
                    placeholder="e.g., Enterprise CTOs from EXA Search"
                    value={segmentName}
                    onChange={(e) => setSegmentName(e.target.value)}
                  />
                </label>
              </div>
            </>
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
            disabled={saving}
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
            }}
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

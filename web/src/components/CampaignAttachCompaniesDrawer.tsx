import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  attachCompaniesToCampaign,
  fetchDirectoryCompanies,
  type CampaignAttachCompaniesResult,
  type DirectoryCompany,
} from '../apiClient';

const translations: Record<string, Record<string, string>> = {
  en: {
    title: 'Attach companies',
    close: 'Close',
    search: 'Search companies...',
    selected: 'selected',
    attach: 'Attach',
    attaching: 'Attaching...',
    selectAll: 'Select all',
    deselectAll: 'Deselect all',
    noCompanies: 'No companies found',
    noSelection: 'Select at least one company',
    resultTitle: 'Attach result',
    attached: 'Attached',
    alreadyPresent: 'Already present',
    blocked: 'Blocked',
    invalid: 'Invalid',
    contacts: 'contacts added',
    contactsPresent: 'contacts already present',
    done: 'Done',
  },
  ru: {
    title: 'Добавить компании',
    close: 'Закрыть',
    search: 'Поиск компаний...',
    selected: 'выбрано',
    attach: 'Добавить',
    attaching: 'Добавление...',
    selectAll: 'Выбрать все',
    deselectAll: 'Снять все',
    noCompanies: 'Компании не найдены',
    noSelection: 'Выберите хотя бы одну компанию',
    resultTitle: 'Результат',
    attached: 'Добавлено',
    alreadyPresent: 'Уже в кампании',
    blocked: 'Заблокировано',
    invalid: 'Невалидно',
    contacts: 'контактов добавлено',
    contactsPresent: 'контактов уже было',
    done: 'Готово',
  },
};

function getT(language: string) {
  return translations[language] ?? translations['en'];
}

type Step = 'pick' | 'result';

export function CampaignAttachCompaniesDrawer({
  open,
  campaignId,
  onClose,
  onAttached,
  language = 'en',
}: {
  open: boolean;
  campaignId: string;
  onClose: () => void;
  onAttached?: () => void;
  language?: string;
}) {
  const t = getT(language);
  const [step, setStep] = useState<Step>('pick');
  const [companies, setCompanies] = useState<DirectoryCompany[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CampaignAttachCompaniesResult | null>(null);

  // Load directory companies when drawer opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingCompanies(true);
    setError(null);
    setStep('pick');
    setSelectedIds(new Set());
    setResult(null);

    fetchDirectoryCompanies({ limit: 500 })
      .then((view) => {
        if (!cancelled) setCompanies(view.items);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? 'Failed to load companies');
      })
      .finally(() => {
        if (!cancelled) setLoadingCompanies(false);
      });

    return () => { cancelled = true; };
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return companies;
    const q = search.toLowerCase();
    return companies.filter(
      (c) =>
        (c.companyName ?? '').toLowerCase().includes(q) ||
        (c.website ?? '').toLowerCase().includes(q) ||
        (c.segment ?? '').toLowerCase().includes(q)
    );
  }, [companies, search]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = () => {
    setSelectedIds(new Set(filtered.map((c) => c.companyId)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleAttach = async () => {
    if (selectedIds.size === 0) {
      setError(t.noSelection);
      return;
    }
    setError(null);
    setAttaching(true);
    try {
      const res = await attachCompaniesToCampaign(campaignId, Array.from(selectedIds));
      setResult(res);
      setStep('result');
      onAttached?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Attach failed');
    } finally {
      setAttaching(false);
    }
  };

  const handleClose = () => {
    setStep('pick');
    setSearch('');
    setSelectedIds(new Set());
    setResult(null);
    setError(null);
    onClose();
  };

  if (!open) return null;

  const STATUS_COLORS: Record<string, string> = {
    attached: 'var(--od-success)',
    already_present: 'var(--od-text-muted)',
    blocked: 'var(--od-warning)',
    invalid: 'var(--od-error)',
  };

  const STATUS_LABELS: Record<string, string> = {
    attached: t.attached,
    already_present: t.alreadyPresent,
    blocked: t.blocked,
    invalid: t.invalid,
  };

  return (
    <>
      <div className="od-drawer-overlay od-drawer-overlay--open" onClick={handleClose} />
      <div className="od-drawer od-drawer--open" style={{ maxWidth: 480, width: '100%' }}>
        <div className="od-drawer__header">
          <h3 className="od-drawer__title">{t.title}</h3>
          <button className="od-drawer__close" onClick={handleClose}>{t.close}</button>
        </div>

        <div className="od-drawer__body" style={{ padding: 16 }}>
          {error && (
            <div className="od-error-banner" role="alert" style={{ marginBottom: 12 }}>{error}</div>
          )}

          {/* Step: Pick */}
          {step === 'pick' && (
            <>
              <div className="od-search" style={{ marginBottom: 10 }}>
                <input
                  className="od-search__input"
                  placeholder={t.search}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
                <button type="button" className="od-btn od-btn--ghost" style={{ fontSize: 10, padding: '2px 8px' }} onClick={handleSelectAll}>
                  {t.selectAll}
                </button>
                <button type="button" className="od-btn od-btn--ghost" style={{ fontSize: 10, padding: '2px 8px' }} onClick={handleDeselectAll}>
                  {t.deselectAll}
                </button>
                {selectedIds.size > 0 && (
                  <span className="od-count-chip" style={{ marginLeft: 'auto' }}>
                    {selectedIds.size} {t.selected}
                  </span>
                )}
              </div>

              {loadingCompanies && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1, 2, 3].map((i) => (
                    <span key={i} className="od-skeleton" style={{ height: 36, width: '100%' }} />
                  ))}
                </div>
              )}

              {!loadingCompanies && filtered.length === 0 && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--od-text-muted)', fontSize: 12 }}>
                  {t.noCompanies}
                </div>
              )}

              {!loadingCompanies && (
                <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {filtered.map((c) => {
                    const checked = selectedIds.has(c.companyId);
                    return (
                      <div
                        key={c.companyId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 4px',
                          borderBottom: '1px solid var(--od-border)',
                          cursor: 'pointer',
                          background: checked ? 'color-mix(in srgb, var(--od-orange) 6%, transparent)' : 'transparent',
                        }}
                        onClick={() => toggleSelect(c.companyId)}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(c.companyId)}
                          style={{ flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: 'var(--od-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.companyName ?? c.companyId}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--od-text-muted)', display: 'flex', gap: 8 }}>
                            {c.segment && <span>{c.segment}</span>}
                            {c.contacts && <span>{c.contacts.total} contacts</span>}
                            {c.enrichment && (
                              <span style={{ color: c.enrichment.status === 'fresh' ? 'var(--od-success)' : c.enrichment.status === 'stale' ? 'var(--od-warning)' : 'var(--od-text-muted)' }}>
                                {c.enrichment.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                className="od-btn od-btn--approve"
                style={{ width: '100%', marginTop: 12 }}
                onClick={handleAttach}
                disabled={attaching || selectedIds.size === 0}
              >
                {attaching ? t.attaching : `${t.attach} (${selectedIds.size})`}
              </button>
            </>
          )}

          {/* Step: Result */}
          {step === 'result' && result && (
            <>
              <h3 className="od-context-block__title" style={{ marginBottom: 10 }}>{t.resultTitle}</h3>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {result.summary.attachedCompanyCount > 0 && (
                  <span className="od-count-chip" style={{ color: 'var(--od-success)' }}>
                    {result.summary.attachedCompanyCount} {t.attached.toLowerCase()}
                  </span>
                )}
                {result.summary.alreadyPresentCompanyCount > 0 && (
                  <span className="od-count-chip">
                    {result.summary.alreadyPresentCompanyCount} {t.alreadyPresent.toLowerCase()}
                  </span>
                )}
                {result.summary.blockedCompanyCount > 0 && (
                  <span className="od-count-chip" style={{ color: 'var(--od-warning)' }}>
                    {result.summary.blockedCompanyCount} {t.blocked.toLowerCase()}
                  </span>
                )}
                {result.summary.invalidCompanyCount > 0 && (
                  <span className="od-count-chip" style={{ color: 'var(--od-error)' }}>
                    {result.summary.invalidCompanyCount} {t.invalid.toLowerCase()}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                <span className="od-count-chip">
                  {result.summary.insertedContactCount} {t.contacts}
                </span>
                {result.summary.alreadyPresentContactCount > 0 && (
                  <span className="od-count-chip">
                    {result.summary.alreadyPresentContactCount} {t.contactsPresent}
                  </span>
                )}
              </div>

              {/* Per-company breakdown */}
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {result.items.map((item) => (
                  <div
                    key={item.companyId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 4px',
                      borderBottom: '1px solid var(--od-border)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--od-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.companyName ?? item.companyId}
                      </div>
                      {item.reason && (
                        <div style={{ fontSize: 10, color: 'var(--od-text-muted)' }}>{item.reason}</div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLORS[item.status] ?? 'var(--od-text-muted)', flexShrink: 0, marginLeft: 8 }}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="od-btn od-btn--ghost"
                style={{ width: '100%', marginTop: 12 }}
                onClick={handleClose}
              >
                {t.done}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

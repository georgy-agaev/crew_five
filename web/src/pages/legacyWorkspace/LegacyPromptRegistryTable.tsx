import type { PromptEntry } from '../../apiClient';
import { getPromptStatusKey } from './legacyWorkspaceMetrics';
import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';

type PromptFilterStatus = 'all' | 'active' | 'pilot' | 'retired';

type PromptRegistryCopy = {
  promptId: string;
  step: string;
  version: string;
  description: string;
  status: string;
  noPrompts: string;
  noPromptsDesc: string;
  active?: string;
  pilot?: string;
  retired?: string;
};

type LegacyPromptRegistryTableProps = {
  colors: LegacyWorkspaceColors & { error: string; success: string; warning: string };
  copy: PromptRegistryCopy;
  entries: PromptEntry[];
  filterStatus: PromptFilterStatus;
  loading: boolean;
  error: string | null;
  onSetActive: (entry: PromptEntry) => Promise<void>;
};

export function LegacyPromptRegistryTable({
  colors,
  copy,
  entries,
  filterStatus,
  loading,
  error,
  onSetActive,
}: LegacyPromptRegistryTableProps) {
  const filtered = entries.filter((entry) => {
    const statusKey = getPromptStatusKey(entry);
    if (filterStatus === 'all') return true;
    if (filterStatus === 'active') return statusKey === 'active';
    if (filterStatus === 'pilot') return entry.rollout_status === 'pilot';
    if (filterStatus === 'retired') return entry.rollout_status === 'retired';
    return true;
  });

  return (
    <div
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: colors.sidebar,
          padding: '16px 20px',
          borderBottom: `1px solid ${colors.border}`,
          display: 'grid',
          gridTemplateColumns: '120px 100px 100px 1fr 180px',
          gap: '16px',
          fontSize: '13px',
          fontWeight: 600,
          color: colors.textMuted,
        }}
      >
        <div>{copy.promptId}</div>
        <div>{copy.step}</div>
        <div>{copy.version}</div>
        <div>{copy.description}</div>
        <div>{copy.status}</div>
      </div>

      {loading ? (
        <div style={{ padding: '40px 32px', textAlign: 'center', fontSize: '14px', color: colors.textMuted }}>
          Loading prompts…
        </div>
      ) : null}
      {!loading && error ? (
        <div style={{ padding: '40px 32px', textAlign: 'center', fontSize: '14px', color: colors.error }}>
          {error}
        </div>
      ) : null}
      {!loading && !error && filtered.length === 0 ? (
        <div style={{ padding: '80px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 600, color: colors.textMuted, marginBottom: '8px' }}>
            {copy.noPrompts}
          </div>
          <div style={{ fontSize: '14px', color: colors.textMuted }}>{copy.noPromptsDesc}</div>
        </div>
      ) : null}
      {!loading && !error && filtered.length > 0 ? (
        <div style={{ display: 'grid' }}>
          {filtered.map((entry) => {
            const statusKey = getPromptStatusKey(entry);
            const label = statusKey && copy[statusKey as keyof PromptRegistryCopy] ? copy[statusKey as keyof PromptRegistryCopy] : '';
            const pillColor =
              statusKey === 'active'
                ? colors.success
                : statusKey === 'pilot'
                  ? colors.warning
                  : colors.textMuted;

            return (
              <div
                key={entry.id}
                style={{
                  padding: '12px 20px',
                  borderBottom: `1px solid ${colors.border}`,
                  display: 'grid',
                  gridTemplateColumns: '120px 100px 100px 1fr 180px',
                  gap: '16px',
                  fontSize: '13px',
                  alignItems: 'center',
                  background: colors.card,
                }}
              >
                <div>{entry.id}</div>
                <div>{entry.step}</div>
                <div>{entry.version}</div>
                <div>{entry.description ?? ''}</div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {label ? (
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#fff',
                          background: pillColor,
                        }}
                      >
                        {label}
                      </span>
                    ) : (
                      <span style={{ fontSize: '12px', color: colors.textMuted }}>—</span>
                    )}
                    <button
                      disabled={statusKey === 'active' || loading}
                      onClick={() => onSetActive(entry)}
                      style={{
                        borderRadius: '999px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        border: `1px solid ${colors.border}`,
                        background: statusKey === 'active' ? colors.sidebar : colors.card,
                        color: statusKey === 'active' ? colors.textMuted : colors.text,
                        cursor: statusKey === 'active' || loading ? 'not-allowed' : 'pointer',
                        opacity: statusKey === 'active' || loading ? 0.6 : 1,
                      }}
                    >
                      {statusKey === 'active' ? 'Active' : 'Set active'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

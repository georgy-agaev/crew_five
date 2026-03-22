import type {
  LegacyWorkspaceColors,
  PromptRegistryFilterStatus,
} from './legacyWorkspaceTypes';

type LegacyPromptRegistryToolbarProps = {
  colors: LegacyWorkspaceColors;
  copy: {
    title: string;
    subtitle: string;
    allPrompts: string;
    active: string;
    pilot: string;
    retired: string;
    createNew: string;
  };
  filterStatus: PromptRegistryFilterStatus;
  showPromptCreate: boolean;
  onCreateToggle: () => void;
  onFilterChange: (status: PromptRegistryFilterStatus) => void;
};

const FILTERS: Array<{
  key: PromptRegistryFilterStatus;
  weight: 500 | 600;
  borderWidth: '1px' | '2px';
}> = [
  { key: 'all', weight: 600, borderWidth: '2px' },
  { key: 'active', weight: 500, borderWidth: '1px' },
  { key: 'pilot', weight: 500, borderWidth: '1px' },
  { key: 'retired', weight: 500, borderWidth: '1px' },
];

export function LegacyPromptRegistryToolbar({
  colors,
  copy,
  filterStatus,
  showPromptCreate,
  onCreateToggle,
  onFilterChange,
}: LegacyPromptRegistryToolbarProps) {
  return (
    <>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>{copy.title}</h1>
        <p style={{ fontSize: '14px', color: colors.textMuted }}>{copy.subtitle}</p>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center' }}>
        {FILTERS.map((filter) => {
          const selected = filterStatus === filter.key;

          return (
            <button
              key={filter.key}
              style={{
                background: selected ? colors.orangeLight : colors.card,
                border: `${filter.borderWidth} solid ${selected ? colors.orange : colors.border}`,
                color: selected ? colors.orange : colors.text,
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: filter.weight,
                cursor: 'pointer',
              }}
              onClick={() => onFilterChange(filter.key)}
            >
              {copyLabel(copy, filter.key)}
            </button>
          );
        })}

        <div style={{ flex: 1 }}></div>

        <button
          onClick={onCreateToggle}
          style={{
            background: colors.orangeLight,
            border: `2px solid ${colors.orange}`,
            color: colors.orange,
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            opacity: showPromptCreate ? 1 : 0.85,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'opacity 0.15s ease',
          }}
        >
          <span>+</span>
          <span>{copy.createNew}</span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              background: '#fff',
              color: colors.orange,
              padding: '2px 6px',
              borderRadius: '4px',
              marginLeft: '4px',
            }}
          >
            SOON
          </span>
        </button>
      </div>
    </>
  );
}

function copyLabel(
  copy: LegacyPromptRegistryToolbarProps['copy'],
  key: PromptRegistryFilterStatus
) {
  if (key === 'all') return copy.allPrompts;
  if (key === 'active') return copy.active;
  if (key === 'pilot') return copy.pilot;
  return copy.retired;
}

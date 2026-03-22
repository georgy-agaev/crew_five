import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';

type SegmentRow = {
  id: string;
  name?: string | null;
  company_count?: number | null;
  source?: string | null;
  icp_profile_id?: string | null;
  icp_hypothesis_id?: string | null;
};

type LegacySegmentStepProps = {
  colors: LegacyWorkspaceColors;
  companiesLabel: string;
  copy: {
    lockedTitle: string;
    lockedSubtitle: string;
    title: string;
    subtitle: string;
    hypothesis: string;
    matching: string;
    source: string;
    generateNew: string;
    searchDB: string;
    searchDesc: string;
    exaSearch: string;
    exaDesc: string;
  };
  discoveryStatus: string | null;
  hasHypothesis: boolean;
  hasPersistedDiscoveryRun: boolean;
  onOpenDiscovery: () => void;
  onOpenExaSearch: () => void;
  onOpenSegmentBuilder: () => void;
  onSelectSegment: (segment: SegmentRow) => void;
  segments: SegmentRow[];
  selectionSummary: {
    icp: string | null;
    hypothesis: string | null;
    selectedSegmentId: string | null;
  };
};

export function LegacySegmentStep({
  colors,
  companiesLabel,
  copy,
  discoveryStatus,
  hasHypothesis,
  hasPersistedDiscoveryRun,
  onOpenDiscovery,
  onOpenExaSearch,
  onOpenSegmentBuilder,
  onSelectSegment,
  segments,
  selectionSummary,
}: LegacySegmentStepProps) {
  if (!hasHypothesis) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 40px' }}>
        <div style={lockedTitleStyle(colors)}>{copy.lockedTitle}</div>
        <div style={{ fontSize: '14px', color: colors.textMuted }}>{copy.lockedSubtitle}</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>{copy.title}</h2>
        <div style={{ fontSize: '14px', color: colors.textMuted, lineHeight: '1.8' }}>
          <div>
            <span style={{ fontWeight: 600 }}>{copy.subtitle}</span>{' '}
            {selectionSummary.icp ?? '—'}
          </div>
          <div>
            <span style={{ fontWeight: 600 }}>{copy.hypothesis}</span>{' '}
            {selectionSummary.hypothesis ?? '—'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '24px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
            {copy.matching}
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            {segments.map((segment) => {
              const isSelected = selectionSummary.selectedSegmentId === segment.id;
              const name = segment.name ?? segment.id;
              const size = segment.company_count ?? 0;
              const source =
                segment.source ??
                (segment.icp_profile_id || segment.icp_hypothesis_id ? 'ICP' : 'Database');

              return (
                <button
                  key={segment.id}
                  onClick={() => onSelectSegment(segment)}
                  style={segmentCardStyle(colors, isSelected)}
                >
                  <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>
                    {name}
                  </div>
                  <div style={{ fontSize: '13px', color: colors.textMuted }}>
                    {size.toLocaleString()} {companiesLabel} • {copy.source}: {source}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
            {copy.generateNew}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <ActionCard
              colors={colors}
              title={copy.searchDB}
              description={copy.searchDesc}
              onClick={onOpenSegmentBuilder}
            />
            <ActionCard
              colors={colors}
              title={copy.exaSearch}
              description={copy.exaDesc}
              onClick={onOpenExaSearch}
            />
          </div>

          {discoveryStatus || hasPersistedDiscoveryRun ? (
            <div style={discoveryStatusStyle(colors)}>
              {discoveryStatus ? <div>{discoveryStatus}</div> : null}
              {hasPersistedDiscoveryRun ? (
                <button type="button" onClick={onOpenDiscovery} style={discoveryButtonStyle(colors)}>
                  Review candidates in ICP Discovery
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  colors,
  title,
  description,
  onClick,
}: {
  colors: LegacyWorkspaceColors;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={actionCardStyle(colors)}>
      <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>
        {title}
      </div>
      <div style={{ fontSize: '13px', color: colors.textMuted, lineHeight: '1.5' }}>
        {description}
      </div>
    </button>
  );
}

function lockedTitleStyle(colors: LegacyWorkspaceColors) {
  return {
    fontSize: '18px',
    fontWeight: 600,
    color: colors.textMuted,
    marginBottom: '8px',
  } as const;
}

function segmentCardStyle(colors: LegacyWorkspaceColors, selected: boolean) {
  return {
    background: colors.card,
    border: `1px solid ${selected ? colors.orange : colors.border}`,
    borderRadius: '8px',
    padding: '16px',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } as const;
}

function actionCardStyle(colors: LegacyWorkspaceColors) {
  return {
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    padding: '20px',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } as const;
}

function discoveryStatusStyle(colors: LegacyWorkspaceColors) {
  return {
    marginTop: '8px',
    fontSize: '12px',
    color: colors.textMuted,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  } as const;
}

function discoveryButtonStyle(colors: LegacyWorkspaceColors) {
  return {
    alignSelf: 'flex-start',
    padding: '4px 10px',
    fontSize: '12px',
    borderRadius: '999px',
    border: `1px solid ${colors.orange}`,
    backgroundColor: colors.orangeLight,
    color: colors.orange,
    cursor: 'pointer',
  } as const;
}

import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';

export type DraftSelectionSummary = {
  icp: string | null;
  hypothesis: string | null;
  segment: string | null;
};

export function DraftStepSummary({
  colors,
  copy,
  selectionSummary,
}: {
  colors: LegacyWorkspaceColors;
  copy: {
    draftLabel: string;
    segmentSubtitleLabel: string;
    hypothesisLabel: string;
    segmentLabel: string;
  };
  selectionSummary: DraftSelectionSummary;
}) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>{copy.draftLabel}</h2>
      <div style={{ fontSize: '14px', color: colors.textMuted, lineHeight: '1.8' }}>
        <div>
          <span style={{ fontWeight: 600 }}>{copy.segmentSubtitleLabel}</span>{' '}
          {selectionSummary.icp ?? '—'}
        </div>
        <div>
          <span style={{ fontWeight: 600 }}>{copy.hypothesisLabel}</span>{' '}
          {selectionSummary.hypothesis ?? '—'}
        </div>
        <div>
          <span style={{ fontWeight: 600 }}>{copy.segmentLabel}:</span>{' '}
          {selectionSummary.segment ?? '—'}
        </div>
      </div>
    </div>
  );
}

export function DraftSummaryCard({
  colors,
  draftSummary,
}: {
  colors: LegacyWorkspaceColors;
  draftSummary: string | null;
}) {
  return (
    <div>
      <div
        style={{
          background: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: '12px',
          padding: '18px 20px',
          marginBottom: '16px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: colors.text }}>
          Draft summary
        </div>
        <div style={{ fontSize: '12px', color: colors.textMuted, lineHeight: '1.6' }}>
          Use this step to generate email drafts bound to the selected campaign and segment. You
          can keep data quality strict for early pilots and switch to graceful once enrichment
          stabilizes.
        </div>
        {draftSummary ? (
          <div
            style={{
              marginTop: '10px',
              fontSize: '12px',
              color: colors.success,
              fontWeight: 600,
            }}
          >
            {draftSummary}
          </div>
        ) : null}
      </div>
    </div>
  );
}

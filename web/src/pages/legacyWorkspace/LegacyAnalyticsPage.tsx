import {
  aggregateAnalyticsMetrics,
  formatAnalyticsGroupKey,
} from './legacyWorkspaceMetrics';
import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';

type AnalyticsGroupBy = 'icp' | 'segment' | 'pattern' | 'offer' | 'hypothesis' | 'recipient_type' | 'sender_identity';

type AnalyticsRow = {
  delivered?: number;
  opened?: number;
  positive_replies?: number;
  replied?: number;
  [key: string]: unknown;
};

type AnalyticsSuggestion = {
  draft_pattern?: string | null;
  recommendation?: string | null;
};

type LegacyAnalyticsCopy = {
  title: string;
  subtitle: string;
  overview: string;
  campaigns: string;
  performance: string;
  noData: string;
  noDataDesc: string;
};

type LegacyAnalyticsPageProps = {
  colors: LegacyWorkspaceColors & { error: string };
  copy: LegacyAnalyticsCopy;
  error: string | null;
  groupBy: AnalyticsGroupBy;
  loading: boolean;
  rows: AnalyticsRow[];
  suggestions: AnalyticsSuggestion[];
  onGroupByChange: (value: AnalyticsGroupBy) => void;
};

export function LegacyAnalyticsPage({
  colors,
  copy,
  error,
  groupBy,
  loading,
  rows,
  suggestions,
  onGroupByChange,
}: LegacyAnalyticsPageProps) {
  const totals = aggregateAnalyticsMetrics(rows);

  return (
    <div style={{ padding: '40px', maxWidth: '1200px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>{copy.title}</h1>
        <p style={{ fontSize: '14px', color: colors.textMuted }}>{copy.subtitle}</p>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <AnalyticsTab
          active={groupBy === 'icp'}
          borderWidth={2}
          colors={colors}
          label={copy.overview}
          onClick={() => onGroupByChange('icp')}
          weight={600}
        />
        <AnalyticsTab
          active={groupBy === 'segment'}
          colors={colors}
          label={copy.campaigns}
          onClick={() => onGroupByChange('segment')}
        />
        <AnalyticsTab
          active={groupBy === 'pattern'}
          colors={colors}
          label={copy.performance}
          onClick={() => onGroupByChange('pattern')}
        />
        <AnalyticsTab
          active={groupBy === 'offer'}
          colors={colors}
          label="Offer"
          onClick={() => onGroupByChange('offer')}
        />
        <AnalyticsTab
          active={groupBy === 'hypothesis'}
          colors={colors}
          label="Hypothesis"
          onClick={() => onGroupByChange('hypothesis')}
        />
        <AnalyticsTab
          active={groupBy === 'recipient_type'}
          colors={colors}
          label="Recipient"
          onClick={() => onGroupByChange('recipient_type')}
        />
        <AnalyticsTab
          active={groupBy === 'sender_identity'}
          colors={colors}
          label="Sender"
          onClick={() => onGroupByChange('sender_identity')}
        />
      </div>

      <div
        style={{
          background: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: '12px',
          padding: '24px 24px 20px',
        }}
      >
        {loading ? (
          <div style={{ fontSize: '14px', color: colors.textMuted, textAlign: 'center' }}>
            Loading analytics…
          </div>
        ) : null}
        {!loading && error ? (
          <div style={{ fontSize: '14px', color: colors.error, textAlign: 'center' }}>{error}</div>
        ) : null}
        {!loading && !error && rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px' }}>
            <div
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: colors.textMuted,
                marginBottom: '8px',
              }}
            >
              {copy.noData}
            </div>
            <div style={{ fontSize: '14px', color: colors.textMuted }}>{copy.noDataDesc}</div>
          </div>
        ) : null}
        {!loading && !error && rows.length > 0 ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <AnalyticsStatCard colors={colors} label="Delivered" value={totals.delivered} />
              <AnalyticsStatCard colors={colors} label="Opened" value={totals.opened} />
              <AnalyticsStatCard colors={colors} label="Replied" value={totals.replied} />
              <AnalyticsStatCard colors={colors} label="Positive" value={totals.positive} />
            </div>

            <div style={{ marginTop: '8px' }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  marginBottom: '8px',
                  color: colors.text,
                }}
              >
                Top patterns
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {rows.slice(0, 5).map((row, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: colors.sidebar,
                    }}
                  >
                    <div
                      style={{
                        fontSize: '12px',
                        color: colors.text,
                        marginRight: '12px',
                        maxWidth: '65%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatAnalyticsGroupKey(groupBy, row)}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        fontSize: '11px',
                        color: colors.textMuted,
                      }}
                    >
                      <span>DLV {row.delivered ?? 0}</span>
                      <span>OPN {row.opened ?? 0}</span>
                      <span>REP {row.replied ?? 0}</span>
                      <span>POS {row.positive_replies ?? 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {suggestions.length > 0 ? (
              <div
                style={{
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: `1px solid ${colors.border}`,
                }}
              >
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    marginBottom: '6px',
                    color: colors.text,
                  }}
                >
                  Prompt suggestions
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: '18px',
                    fontSize: '12px',
                    color: colors.textMuted,
                  }}
                >
                  {suggestions.slice(0, 3).map((suggestion, index) => (
                    <li key={index}>
                      {suggestion.draft_pattern ?? 'pattern'}{' '}
                      {suggestion.recommendation ? `→ ${suggestion.recommendation}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function AnalyticsTab({
  active,
  borderWidth = 1,
  colors,
  label,
  onClick,
  weight = 500,
}: {
  active: boolean;
  borderWidth?: number;
  colors: LegacyWorkspaceColors;
  label: string;
  onClick: () => void;
  weight?: number;
}) {
  return (
    <button
      style={{
        background: active ? colors.orangeLight : colors.card,
        border: `${borderWidth}px solid ${active ? colors.orange : colors.border}`,
        color: active ? colors.orange : colors.text,
        padding: '10px 20px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: weight,
        cursor: 'pointer',
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function AnalyticsStatCard({
  colors,
  label,
  value,
}: {
  colors: LegacyWorkspaceColors;
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        flex: '1 1 140px',
        minWidth: '140px',
        background: colors.sidebar,
        borderRadius: '8px',
        padding: '10px 12px',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: colors.textMuted,
          marginBottom: '4px',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: '18px', fontWeight: 700, color: colors.text }}>{value}</div>
    </div>
  );
}

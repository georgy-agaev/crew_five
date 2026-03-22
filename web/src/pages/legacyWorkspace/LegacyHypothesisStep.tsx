import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';
import { fieldStyle, primaryButtonStyle } from './legacyWorkspaceStepStyles';

type HypothesisRow = {
  id: string;
  hypothesis_label?: string | null;
  text?: string | null;
  confidence?: string | null;
  status?: string | null;
};

type LegacyHypothesisStepProps = {
  aiLoading: boolean;
  colors: LegacyWorkspaceColors;
  copy: {
    lockedTitle: string;
    lockedSubtitle: string;
    title: string;
    subtitle: string;
    suggested: string;
    confidence: string;
    aiTitle: string;
    chatDesc: string;
    writeHyp: string;
    writeDesc: string;
  };
  hasIcp: boolean;
  hypotheses: HypothesisRow[];
  icpName: string | null;
  newHypothesisLabel: string;
  selectedHypothesisId: string | null;
  onCreateQuick: () => void | Promise<void>;
  onOpenAiChat: () => void;
  onQuickLabelChange: (value: string) => void;
  onSelectHypothesis: (hypothesis: HypothesisRow) => void;
};

export function LegacyHypothesisStep({
  aiLoading,
  colors,
  copy,
  hasIcp,
  hypotheses,
  icpName,
  newHypothesisLabel,
  selectedHypothesisId,
  onCreateQuick,
  onOpenAiChat,
  onQuickLabelChange,
  onSelectHypothesis,
}: LegacyHypothesisStepProps) {
  if (!hasIcp) {
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
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>{copy.title}</h2>
        <p style={{ fontSize: '14px', color: colors.textMuted, lineHeight: '1.6' }}>
          {copy.subtitle}{' '}
          <span style={{ fontWeight: 600, color: colors.orange }}>{icpName ?? '—'}</span>
        </p>
      </div>

      <div style={{ display: 'grid', gap: '24px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
            {copy.suggested}
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            {hypotheses.map((hypothesis) => {
              const label =
                hypothesis.hypothesis_label ?? hypothesis.text ?? hypothesis.id;
              const confidenceLabel =
                hypothesis.confidence ??
                (hypothesis.status === 'active' ? 'High' : 'Medium');
              const isSelected = selectedHypothesisId === hypothesis.id;

              return (
                <button
                  key={hypothesis.id}
                  onClick={() => onSelectHypothesis(hypothesis)}
                  style={suggestionCardStyle(colors, isSelected)}
                >
                  <div
                    style={{
                      fontSize: '14px',
                      marginBottom: '8px',
                      color: colors.text,
                      lineHeight: '1.5',
                    }}
                  >
                    {label}
                  </div>
                  <div style={{ fontSize: '12px', color: colors.textMuted }}>
                    {copy.confidence}:{' '}
                    <span
                      style={{
                        fontWeight: 600,
                        color:
                          confidenceLabel === 'High' ? colors.success : colors.warning,
                      }}
                    >
                      {confidenceLabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <ActionCard
              colors={colors}
              title={copy.aiTitle}
              description={copy.chatDesc}
              onClick={onOpenAiChat}
            />
            <ActionCard
              colors={colors}
              title={copy.writeHyp}
              description={copy.writeDesc}
              onClick={() => undefined}
            />
          </div>

          <div style={{ marginTop: '12px', display: 'grid', gap: '8px' }}>
            <input
              placeholder="Hypothesis label"
              value={newHypothesisLabel}
              onChange={(event) => onQuickLabelChange(event.target.value)}
              style={fieldStyle(colors)}
            />
            <button
              onClick={() => void onCreateQuick()}
              disabled={aiLoading}
              style={{
                ...primaryButtonStyle(colors, aiLoading, '10px 16px'),
                marginTop: '4px',
              }}
            >
              Save hypothesis
            </button>
          </div>
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

function suggestionCardStyle(colors: LegacyWorkspaceColors, selected: boolean) {
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

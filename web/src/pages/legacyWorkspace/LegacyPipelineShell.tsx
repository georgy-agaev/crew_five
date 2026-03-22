import type { ReactNode } from 'react';
import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';

type PipelineStep = {
  id: string;
  label: string;
  number: number;
  locked: boolean;
  description: string;
  comingSoon?: boolean;
};

type IcpSelection = {
  id?: string;
  name?: string;
};

type HypothesisSelection = {
  id?: string;
  text?: string;
  hypothesis_label?: string;
};

type SegmentSelection = {
  id?: string;
  name?: string;
};

type SelectionSummary = {
  icp?: IcpSelection | null;
  hypothesis?: HypothesisSelection | null;
  segment?: SegmentSelection | null;
  [key: string]: unknown;
};
type IcpSummary = {
  valueProp?: string;
  industries?: string[];
  companySizes?: string[];
  pains?: string[];
  triggers?: string[];
};
type HypothesisSummary = {
  regions?: string[];
  offers?: Array<{ personaRole?: string; offer?: string }>;
  critiques?: Array<{ roast?: string }>;
};
type Props = {
  children: ReactNode;
  colors: LegacyWorkspaceColors;
  completed: SelectionSummary;
  currentConfigLabel: string;
  currentStep: string;
  hypothesisSummary?: HypothesisSummary | null;
  icpSummary?: IcpSummary | null;
  notSelectedLabel: string;
  pipeline: PipelineStep[];
  stepLabels: {
    icp: string;
    hypothesis: string;
    segment: string;
  };
  onStepSelect: (stepId: string) => void;
};

export function LegacyPipelineShell({
  children,
  colors,
  completed,
  currentConfigLabel,
  currentStep,
  hypothesisSummary,
  icpSummary,
  notSelectedLabel,
  pipeline,
  stepLabels,
  onStepSelect,
}: Props) {
  const summaryLabelStyle = {
    fontSize: '12px',
    color: colors.textMuted,
    marginBottom: '8px',
    fontWeight: 600,
  } as const;

  const emptyState = (
    <div style={{ fontSize: '14px', color: colors.textMuted, fontStyle: 'italic' }}>{notSelectedLabel}</div>
  );

  return (
    <>
      <div
        style={{
          background: colors.sidebar,
          borderBottom: `1px solid ${colors.border}`,
          padding: '20px 40px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {pipeline.map((step, index) => {
            const isComplete = Boolean(completed[step.id]);
            const isActive = currentStep === step.id;
            return (
              <div key={step.id} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <button
                  onClick={() => {
                    if (!step.locked && !step.comingSoon) onStepSelect(step.id);
                  }}
                  disabled={step.locked || step.comingSoon}
                  style={{
                    background: isActive ? colors.orange : isComplete ? colors.orangeLight : 'transparent',
                    border: `2px solid ${isActive || isComplete ? colors.orange : colors.border}`,
                    color: isActive
                      ? '#FFF'
                      : isComplete
                        ? colors.orange
                        : step.locked || step.comingSoon
                          ? colors.textMuted
                          : colors.text,
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: step.locked || step.comingSoon ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: isActive ? 600 : 500,
                    opacity: step.locked || step.comingSoon ? 0.5 : 1,
                    transition: 'all 0.2s ease',
                    width: '100%',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    position: 'relative',
                  }}
                >
                  <div>
                    {step.number}. {step.label}
                  </div>
                  {step.comingSoon ? (
                    <div
                      style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        background: colors.warning,
                        color: '#FFF',
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px',
                      }}
                    >
                      Soon
                    </div>
                  ) : null}
                </button>
                {index < pipeline.length - 1 ? (
                  <div
                    style={{
                      width: '16px',
                      height: '2px',
                      background: completed[pipeline[index + 1].id] ? colors.orange : colors.border,
                      margin: '0 4px',
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'flex', flex: 1 }}>
        <div
          style={{
            width: '320px',
            background: colors.sidebar,
            borderRight: `1px solid ${colors.border}`,
            padding: '32px 24px',
          }}
        >
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: colors.textMuted,
              marginBottom: '24px',
            }}
          >
            {currentConfigLabel}
          </h3>
          <div style={{ display: 'grid', gap: '20px' }}>
            <div>
              <div style={summaryLabelStyle}>{stepLabels.icp}</div>
              {completed.icp ? (
                <div
                  style={{
                    background: colors.card,
                    border: `1px solid ${colors.orange}`,
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '14px',
                    fontWeight: 500,
                  }}
                >
                  <div>{completed.icp.name ?? completed.icp.id}</div>
                  {icpSummary ? (
                    <div
                      style={{
                        marginTop: '6px',
                        fontSize: '12px',
                        color: colors.textMuted,
                        lineHeight: '1.4',
                        fontWeight: 400,
                      }}
                    >
                      {icpSummary.valueProp ? <div>Value prop: {icpSummary.valueProp}</div> : null}
                      {icpSummary.industries?.length ? (
                        <div>
                          Industries: {icpSummary.industries.join(', ')}
                          {icpSummary.companySizes?.length
                            ? ` (${icpSummary.companySizes.join(', ')})`
                            : ''}
                        </div>
                      ) : null}
                      {icpSummary.pains?.length ? <div>Pains: {icpSummary.pains.join(', ')}</div> : null}
                      {icpSummary.triggers?.length ? (
                        <div>Triggers: {icpSummary.triggers.join(', ')}</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                emptyState
              )}
            </div>
            <div>
              <div style={summaryLabelStyle}>{stepLabels.hypothesis}</div>
              {completed.hypothesis ? (
                <div
                  style={{
                    background: colors.card,
                    border: `1px solid ${colors.orange}`,
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '13px',
                    lineHeight: '1.5',
                  }}
                >
                  <div>
                    {completed.hypothesis.hypothesis_label ??
                      completed.hypothesis.text ??
                      completed.hypothesis.id}
                  </div>
                  {hypothesisSummary ? (
                    <div
                      style={{
                        marginTop: '6px',
                        fontSize: '12px',
                        color: colors.textMuted,
                        lineHeight: '1.4',
                        fontWeight: 400,
                      }}
                    >
                      {hypothesisSummary.regions?.length ? (
                        <div>Region: {hypothesisSummary.regions.join(', ')}</div>
                      ) : null}
                      {hypothesisSummary.offers?.length ? (
                        <div>
                          Offers:{' '}
                          {hypothesisSummary.offers
                            .map((entry) => `${entry.personaRole ?? 'Persona'} – ${entry.offer}`)
                            .join('; ')}
                        </div>
                      ) : null}
                      {hypothesisSummary.critiques?.length ? (
                        <div>
                          Critiques:{' '}
                          {hypothesisSummary.critiques
                            .map((entry) => entry.roast)
                            .filter(Boolean)
                            .join('; ')}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                emptyState
              )}
            </div>
            <div>
              <div style={summaryLabelStyle}>{stepLabels.segment}</div>
              {completed.segment ? (
                <div
                  style={{
                    background: colors.card,
                    border: `1px solid ${colors.orange}`,
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '14px',
                    fontWeight: 500,
                  }}
                >
                  {completed.segment.name}
                </div>
              ) : (
                emptyState
              )}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>{children}</div>
      </div>
    </>
  );
}

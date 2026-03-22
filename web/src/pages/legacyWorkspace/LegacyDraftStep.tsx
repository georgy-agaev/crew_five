import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';
import {
  DraftStepSummary,
  DraftSummaryCard,
  type DraftSelectionSummary,
} from './LegacyDraftSummarySections';
import { LegacyDraftCampaignSettingsCard } from './LegacyDraftCampaignSettingsCard';

type NamedRow = {
  id: string;
  name?: string | null;
};

type LegacyDraftStepProps = {
  campaignCreateBusy: boolean;
  campaignCreateError: string | null;
  campaigns: NamedRow[];
  colors: LegacyWorkspaceColors;
  copy: {
    lockedTitle: string;
    lockedSubtitle: string;
    draftLabel: string;
    segmentSubtitleLabel: string;
    hypothesisLabel: string;
    segmentLabel: string;
  };
  dataQualityMode: 'strict' | 'graceful';
  draftDryRun: boolean;
  draftLimit: number;
  draftLoading: boolean;
  draftSummary: string | null;
  hasSegment: boolean;
  interactionMode: 'express' | 'coach';
  newCampaignName: string;
  selectedCampaignId: string;
  selectionSummary: DraftSelectionSummary;
  onCampaignChange: (value: string) => void;
  onCreateCampaign: () => void | Promise<void>;
  onDataQualityModeChange: (value: 'strict' | 'graceful') => void;
  onDraftDryRunChange: (value: boolean) => void;
  onDraftLimitChange: (value: number) => void;
  onGenerateDrafts: () => void | Promise<void>;
  onInteractionModeChange: (value: 'express' | 'coach') => void;
  onNewCampaignNameChange: (value: string) => void;
};

export function LegacyDraftStep({
  campaignCreateBusy,
  campaignCreateError,
  campaigns,
  colors,
  copy,
  dataQualityMode,
  draftDryRun,
  draftLimit,
  draftLoading,
  draftSummary,
  hasSegment,
  interactionMode,
  newCampaignName,
  selectedCampaignId,
  selectionSummary,
  onCampaignChange,
  onCreateCampaign,
  onDataQualityModeChange,
  onDraftDryRunChange,
  onDraftLimitChange,
  onGenerateDrafts,
  onInteractionModeChange,
  onNewCampaignNameChange,
}: LegacyDraftStepProps) {
  if (!hasSegment) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 40px' }}>
        <div
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: colors.textMuted,
            marginBottom: '8px',
          }}
        >
          {copy.lockedTitle}
        </div>
        <div style={{ fontSize: '14px', color: colors.textMuted }}>{copy.lockedSubtitle}</div>
      </div>
    );
  }

  return (
    <div>
      <DraftStepSummary colors={colors} copy={copy} selectionSummary={selectionSummary} />

      <div
        style={{
          display: 'grid',
          gap: '20px',
          gridTemplateColumns: '2fr 1.2fr',
          alignItems: 'flex-start',
        }}
      >
        <LegacyDraftCampaignSettingsCard
          campaignCreateBusy={campaignCreateBusy}
          campaignCreateError={campaignCreateError}
          campaigns={campaigns}
          colors={colors}
          dataQualityMode={dataQualityMode}
          draftDryRun={draftDryRun}
          draftLimit={draftLimit}
          draftLoading={draftLoading}
          draftSummary={draftSummary}
          hasSegment={hasSegment}
          interactionMode={interactionMode}
          newCampaignName={newCampaignName}
          selectedCampaignId={selectedCampaignId}
          onCampaignChange={onCampaignChange}
          onCreateCampaign={onCreateCampaign}
          onDataQualityModeChange={onDataQualityModeChange}
          onDraftDryRunChange={onDraftDryRunChange}
          onDraftLimitChange={onDraftLimitChange}
          onGenerateDrafts={onGenerateDrafts}
          onInteractionModeChange={onInteractionModeChange}
          onNewCampaignNameChange={onNewCampaignNameChange}
        />

        <DraftSummaryCard colors={colors} draftSummary={draftSummary} />
      </div>
    </div>
  );
}

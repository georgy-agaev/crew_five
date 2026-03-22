import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';
import { LabeledField, ModeToggle, ToggleButton } from './LegacyDraftControlPrimitives';
import {
  fieldStyle,
  labelStyle,
  primaryButtonStyle,
  sectionTitleStyle,
} from './legacyWorkspaceStepStyles';

type NamedRow = {
  id: string;
  name?: string | null;
};

type LegacyDraftCampaignSettingsCardProps = {
  campaignCreateBusy: boolean;
  campaignCreateError: string | null;
  campaigns: NamedRow[];
  colors: LegacyWorkspaceColors;
  dataQualityMode: 'strict' | 'graceful';
  draftDryRun: boolean;
  draftLimit: number;
  draftLoading: boolean;
  draftSummary: string | null;
  hasSegment: boolean;
  interactionMode: 'express' | 'coach';
  newCampaignName: string;
  selectedCampaignId: string;
  onCampaignChange: (value: string) => void;
  onCreateCampaign: () => void | Promise<void>;
  onDataQualityModeChange: (value: 'strict' | 'graceful') => void;
  onDraftDryRunChange: (value: boolean) => void;
  onDraftLimitChange: (value: number) => void;
  onGenerateDrafts: () => void | Promise<void>;
  onInteractionModeChange: (value: 'express' | 'coach') => void;
  onNewCampaignNameChange: (value: string) => void;
};

export function LegacyDraftCampaignSettingsCard({
  campaignCreateBusy,
  campaignCreateError,
  campaigns,
  colors,
  dataQualityMode,
  draftDryRun,
  draftLimit,
  draftLoading,
  draftSummary,
  hasSegment,
  interactionMode,
  newCampaignName,
  selectedCampaignId,
  onCampaignChange,
  onCreateCampaign,
  onDataQualityModeChange,
  onDraftDryRunChange,
  onDraftLimitChange,
  onGenerateDrafts,
  onInteractionModeChange,
  onNewCampaignNameChange,
}: LegacyDraftCampaignSettingsCardProps) {
  return (
    <div
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        padding: '20px',
      }}
    >
      <h3 style={sectionTitleStyle(colors)}>Campaign & generation settings</h3>

      <div style={{ display: 'grid', gap: '12px' }}>
        <CampaignSection
          campaignCreateBusy={campaignCreateBusy}
          campaignCreateError={campaignCreateError}
          campaigns={campaigns}
          colors={colors}
          hasSegment={hasSegment}
          newCampaignName={newCampaignName}
          selectedCampaignId={selectedCampaignId}
          onCampaignChange={onCampaignChange}
          onCreateCampaign={onCreateCampaign}
          onNewCampaignNameChange={onNewCampaignNameChange}
        />

        <LabeledField colors={colors} label="Draft limit">
          <input
            type="number"
            min={1}
            max={500}
            value={draftLimit}
            onChange={(event) => onDraftLimitChange(Number(event.target.value) || 0)}
            style={fieldStyle(colors)}
          />
        </LabeledField>

        <div style={{ display: 'flex', gap: '12px' }}>
          <ModeToggle
            colors={colors}
            label="Data quality"
            value={dataQualityMode}
            options={[
              { value: 'strict', label: 'Strict' },
              { value: 'graceful', label: 'Graceful' },
            ]}
            onChange={onDataQualityModeChange}
          />
          <ModeToggle
            colors={colors}
            label="Interaction mode"
            value={interactionMode}
            options={[
              { value: 'express', label: 'Express' },
              { value: 'coach', label: 'Coach' },
            ]}
            onChange={onInteractionModeChange}
          />
        </div>

        <div>
          <div style={labelStyle(colors)}>Draft execution</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <ToggleButton
              active={draftDryRun}
              colors={colors}
              label="Dry-run"
              onClick={() => onDraftDryRunChange(true)}
            />
            <ToggleButton
              active={!draftDryRun}
              colors={colors}
              label="Live (save drafts)"
              onClick={() => onDraftDryRunChange(false)}
            />
          </div>
          <div style={{ marginTop: '6px', fontSize: '12px', color: colors.textMuted }}>
            Dry-run returns counts only. Live mode writes drafts to Supabase.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button
            onClick={() => void onGenerateDrafts()}
            disabled={draftLoading || !selectedCampaignId}
            style={primaryButtonStyle(colors, draftLoading || !selectedCampaignId)}
          >
            {draftLoading ? 'Generating…' : 'Generate drafts'}
          </button>
        </div>

        {draftSummary ? (
          <div style={{ marginTop: '10px', fontSize: '12px', color: colors.textMuted }}>
            {draftSummary}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CampaignSection({
  campaignCreateBusy,
  campaignCreateError,
  campaigns,
  colors,
  hasSegment,
  newCampaignName,
  selectedCampaignId,
  onCampaignChange,
  onCreateCampaign,
  onNewCampaignNameChange,
}: {
  campaignCreateBusy: boolean;
  campaignCreateError: string | null;
  campaigns: NamedRow[];
  colors: LegacyWorkspaceColors;
  hasSegment: boolean;
  newCampaignName: string;
  selectedCampaignId: string;
  onCampaignChange: (value: string) => void;
  onCreateCampaign: () => void | Promise<void>;
  onNewCampaignNameChange: (value: string) => void;
}) {
  return (
    <div>
      <LabeledField colors={colors} label="Campaign">
        <select
          value={selectedCampaignId}
          onChange={(event) => onCampaignChange(event.target.value)}
          style={fieldStyle(colors)}
        >
          <option value="">Select campaign</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name ?? campaign.id}
            </option>
          ))}
        </select>
      </LabeledField>

      <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
        <input
          value={newCampaignName}
          onChange={(event) => onNewCampaignNameChange(event.target.value)}
          placeholder="New campaign name"
          style={fieldStyle(colors)}
        />
        <button
          type="button"
          onClick={() => void onCreateCampaign()}
          disabled={campaignCreateBusy || !hasSegment}
          style={primaryButtonStyle(colors, campaignCreateBusy || !hasSegment, '10px 16px')}
        >
          {campaignCreateBusy ? 'Creating…' : 'Create campaign'}
        </button>
        {campaignCreateError ? (
          <div style={{ fontSize: '12px', color: colors.error }}>{campaignCreateError}</div>
        ) : campaigns.length === 0 ? (
          <div style={{ fontSize: '12px', color: colors.textMuted }}>
            No campaigns found yet — create your first campaign to generate drafts.
          </div>
        ) : null}
      </div>
    </div>
  );
}

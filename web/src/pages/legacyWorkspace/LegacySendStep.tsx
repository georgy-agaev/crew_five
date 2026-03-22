import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';

type NamedRow = {
  id: string;
  name?: string | null;
};

type LegacySendStepProps = {
  campaigns: NamedRow[];
  colors: LegacyWorkspaceColors;
  copy: {
    lockedTitle: string;
    lockedSubtitle: string;
    notSelected: string;
    sendLabel: string;
  };
  hasDraft: boolean;
  selectedCampaignId: string;
  selectedSmartleadCampaignId: string;
  sendBatchSize: number;
  sendDryRun: boolean;
  sendLoading: boolean;
  sendSummary: string | null;
  smartleadCampaigns: NamedRow[];
  smartleadReady: boolean;
  onBatchSizeChange: (value: number) => void;
  onDryRunChange: (value: boolean) => void;
  onPrepare: () => void | Promise<void>;
  onSmartleadCampaignChange: (value: string) => void;
};

export function LegacySendStep({
  campaigns,
  colors,
  copy,
  hasDraft,
  selectedCampaignId,
  selectedSmartleadCampaignId,
  sendBatchSize,
  sendDryRun,
  sendLoading,
  sendSummary,
  smartleadCampaigns,
  smartleadReady,
  onBatchSizeChange,
  onDryRunChange,
  onPrepare,
  onSmartleadCampaignChange,
}: LegacySendStepProps) {
  if (!hasDraft) {
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

  const selectedCampaignLabel = selectedCampaignId
    ? campaigns.find((campaign) => campaign.id === selectedCampaignId)?.name ?? selectedCampaignId
    : copy.notSelected;
  const prepareDisabled =
    sendLoading || !smartleadReady || !selectedSmartleadCampaignId || !selectedCampaignId;

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>
          {copy.sendLabel}
        </h2>
        <div style={{ fontSize: '14px', color: colors.textMuted, lineHeight: '1.8' }}>
          <div>
            <span style={{ fontWeight: 600 }}>Delivery provider:</span>{' '}
            {smartleadReady ? 'Smartlead (ready)' : 'Smartlead (not configured)'}
          </div>
          <div>
            <span style={{ fontWeight: 600 }}>Campaign:</span> {selectedCampaignLabel}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '20px',
          gridTemplateColumns: '2fr 1.2fr',
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            background: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 600,
              marginBottom: '16px',
              color: colors.text,
            }}
          >
            Smartlead prepare
          </h3>

          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colors.textMuted,
                  marginBottom: '4px',
                }}
              >
                Smartlead campaign
              </div>
              <select
                value={selectedSmartleadCampaignId}
                onChange={(event) => onSmartleadCampaignChange(event.target.value)}
                style={selectStyle(colors)}
              >
                <option value="">Select Smartlead campaign</option>
                {smartleadCampaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name ?? campaign.id}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gap: '10px', marginTop: '8px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <label
                  style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    fontSize: '12px',
                    color: colors.textMuted,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={sendDryRun}
                    onChange={(event) => onDryRunChange(event.target.checked)}
                  />
                  Dry-run (no Smartlead changes)
                </label>
                <label
                  style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    fontSize: '12px',
                    color: colors.textMuted,
                  }}
                >
                  Batch size
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={sendBatchSize}
                    onChange={(event) =>
                      onBatchSizeChange(
                        Math.max(1, Math.min(500, Number(event.target.value) || 1))
                      )
                    }
                    style={{
                      width: '88px',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      background: colors.card,
                      fontSize: '12px',
                    }}
                  />
                </label>
              </div>

              <button
                onClick={() => void onPrepare()}
                disabled={prepareDisabled}
                style={{
                  background: colors.orange,
                  color: '#FFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: prepareDisabled ? 'not-allowed' : 'pointer',
                  opacity: prepareDisabled ? 0.7 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                {sendLoading ? 'Preparing…' : 'Prepare Smartlead'}
              </button>
            </div>

            {sendSummary ? (
              <div style={{ marginTop: '10px', fontSize: '12px', color: colors.textMuted }}>
                {sendSummary}
              </div>
            ) : null}
          </div>
        </div>

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
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                marginBottom: '6px',
                color: colors.text,
              }}
            >
              Safety guardrail
            </div>
            <div style={{ fontSize: '12px', color: colors.textMuted, lineHeight: '1.6' }}>
              This step pushes leads from the selected campaign’s segment snapshot to Smartlead
              and syncs the first email sequence step from the first generated draft. Smartlead
              will send once the campaign is active in Smartlead.
            </div>
            {sendSummary ? (
              <div
                style={{
                  marginTop: '10px',
                  fontSize: '12px',
                  color: colors.success,
                  fontWeight: 600,
                }}
              >
                {sendSummary}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function selectStyle(colors: LegacyWorkspaceColors) {
  return {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
    background: colors.card,
    fontSize: '14px',
  };
}

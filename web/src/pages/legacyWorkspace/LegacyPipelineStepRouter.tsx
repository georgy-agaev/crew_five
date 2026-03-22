import { LegacyDraftStep } from './LegacyDraftStep';
import { LegacyEnrichmentStep } from './LegacyEnrichmentStep';
import { LegacyHypothesisStep } from './LegacyHypothesisStep';
import { LegacyIcpStep } from './LegacyIcpStep';
import { LegacySegmentStep } from './LegacySegmentStep';
import { LegacySendStep } from './LegacySendStep';
import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';

type NamedRow = { id: string; name?: string | null };
type IcpProfileRow = NamedRow & { company_count?: number | null; updated_at?: string | null; created_at?: string | null };
type HypothesisRow = { id: string; hypothesis_label?: string | null; text?: string | null; confidence?: string | null; status?: string | null };
type SegmentRow = NamedRow & { company_count?: number | null; source?: string | null; icp_profile_id?: string | null; icp_hypothesis_id?: string | null };
type ProviderOption = { id: string; label: string };
type EnrichResult = { provider: string; status: string; error?: string | null };
type CompletedState = {
  icp?: { id?: string; name?: string } | null;
  hypothesis?: { id?: string; text?: string; hypothesis_label?: string } | null;
  segment?: { id?: string; name?: string; source?: string } | null;
  draft?: Record<string, unknown> | null;
};

type Copy = {
  locked: { title: string; subtitle: string };
  steps: { draft: { label: string }; segment: { label: string }; send: { label: string } };
  segment: { subtitle: string; hypothesis: string; title: string; matching: string; source: string; generateNew: string; searchDB: string; searchDesc: string; exaSearch: string; exaDesc: string };
  icp: { title: string; subtitle: string; chooseExisting: string; createNew: string; updated: string; chatWithAI: string; chatDesc: string; quickEntry: string; quickDesc: string; companies: string };
  hypothesis: { title: string; subtitle: string; suggested: string; confidence: string; chatDesc: string; writeHyp: string; writeDesc: string };
  enrichment: { title: string; subtitle: string; from: string; optional: string; optionalDesc: string; companyData: string; companyDesc: string; leadDetails: string; leadDesc: string; webIntel: string; webDesc: string; enrich: string; skip: string };
  notSelected: string;
};

type Props = {
  aiLoading: boolean;
  campaignCreateBusy?: boolean;
  campaignCreateError?: string | null;
  campaigns?: NamedRow[];
  colors: LegacyWorkspaceColors;
  completed: CompletedState;
  copy: Copy;
  currentStep: string;
  dataQualityMode?: 'strict' | 'graceful';
  discoveryStatus?: string | null;
  draftDryRun?: boolean;
  draftLimit?: number;
  draftLoading?: boolean;
  draftSummary?: string | null;
  enrichLoading?: boolean;
  enrichResults?: EnrichResult[] | null;
  enrichStatus?: string | null;
  enrichmentDefaults?: string[];
  enrichmentPrimarySummary?: { company: string | null; lead: string | null };
  hasPersistedDiscoveryRun?: boolean;
  hypotheses?: HypothesisRow[];
  icpProfiles?: IcpProfileRow[];
  interactionMode?: 'express' | 'coach';
  isProviderReady?: (providerId: string) => boolean;
  newCampaignName?: string;
  newHypothesisLabel?: string;
  newIcpDescription?: string;
  newIcpName?: string;
  providerOptions?: ProviderOption[];
  segments?: SegmentRow[];
  selectedCampaignId?: string;
  selectedProviders?: string[];
  selectedSmartleadCampaignId?: string;
  sendBatchSize?: number;
  sendDryRun?: boolean;
  sendLoading?: boolean;
  sendSummary?: string | null;
  smartleadCampaigns?: NamedRow[];
  smartleadReady?: boolean;
  onBatchSizeChange?: (value: number) => void;
  onCampaignChange?: (value: string) => void;
  onCreateCampaign?: () => void | Promise<void>;
  onCreateHypothesisQuick?: () => void | Promise<void>;
  onCreateIcpQuick?: () => void | Promise<void>;
  onDataQualityModeChange?: (value: 'strict' | 'graceful') => void;
  onDraftDryRunChange?: (value: boolean) => void;
  onDraftLimitChange?: (value: number) => void;
  onEnrich?: () => void | Promise<void>;
  onGenerateDrafts?: () => void | Promise<void>;
  onHypothesisLabelChange?: (value: string) => void;
  onIcpDescriptionChange?: (value: string) => void;
  onIcpNameChange?: (value: string) => void;
  onInteractionModeChange?: (value: 'express' | 'coach') => void;
  onNewCampaignNameChange?: (value: string) => void;
  onOpenAiChat?: () => void;
  onOpenDiscovery?: () => void;
  onOpenExaSearch?: () => void;
  onOpenSegmentBuilder?: () => void;
  onPrepareSend?: () => void | Promise<void>;
  onProviderToggle?: (providerId: string) => void;
  onResetProviders?: () => void;
  onSelectHypothesis?: (hypothesis: HypothesisRow) => void;
  onSelectIcp?: (profile: IcpProfileRow) => void;
  onSelectSegment?: (segment: SegmentRow) => void;
  onSendDryRunChange?: (value: boolean) => void;
  onSkipEnrichment?: () => void;
  onSmartleadCampaignChange?: (value: string) => void;
};

const noop = () => undefined;
const noopAsync = async () => undefined;
const isProviderReadyDefault = () => true;

export function LegacyPipelineStepRouter({
  aiLoading,
  campaignCreateBusy = false,
  campaignCreateError = null,
  campaigns = [],
  colors,
  completed,
  copy,
  currentStep,
  dataQualityMode = 'strict',
  discoveryStatus = null,
  draftDryRun = false,
  draftLimit = 50,
  draftLoading = false,
  draftSummary = null,
  enrichLoading = false,
  enrichResults = null,
  enrichStatus = null,
  enrichmentDefaults = [],
  enrichmentPrimarySummary = { company: null, lead: null },
  hasPersistedDiscoveryRun = false,
  hypotheses = [],
  icpProfiles = [],
  interactionMode = 'express',
  isProviderReady = isProviderReadyDefault,
  newCampaignName = '',
  newHypothesisLabel = '',
  newIcpDescription = '',
  newIcpName = '',
  onBatchSizeChange = noop,
  onCampaignChange = noop,
  onCreateCampaign = noopAsync,
  onCreateHypothesisQuick = noopAsync,
  onCreateIcpQuick = noopAsync,
  onDataQualityModeChange = noop,
  onDraftDryRunChange = noop,
  onDraftLimitChange = noop,
  onEnrich = noopAsync,
  onGenerateDrafts = noopAsync,
  onHypothesisLabelChange = noop,
  onIcpDescriptionChange = noop,
  onIcpNameChange = noop,
  onInteractionModeChange = noop,
  onNewCampaignNameChange = noop,
  onOpenAiChat = noop,
  onOpenDiscovery = noop,
  onOpenExaSearch = noop,
  onOpenSegmentBuilder = noop,
  onPrepareSend = noopAsync,
  onProviderToggle = noop,
  onResetProviders = noop,
  onSelectHypothesis = noop,
  onSelectIcp = noop,
  onSelectSegment = noop,
  onSendDryRunChange = noop,
  onSkipEnrichment = noop,
  onSmartleadCampaignChange = noop,
  providerOptions = [],
  segments = [],
  selectedCampaignId = '',
  selectedProviders = [],
  selectedSmartleadCampaignId = '',
  sendBatchSize = 50,
  sendDryRun = true,
  sendLoading = false,
  sendSummary = null,
  smartleadCampaigns = [],
  smartleadReady = false,
}: Props) {
  switch (currentStep) {
    case 'icp':
      return <LegacyIcpStep aiLoading={aiLoading} colors={colors} companiesLabel={copy.icp.companies} copy={{ title: copy.icp.title, subtitle: copy.icp.subtitle, chooseExisting: copy.icp.chooseExisting, createNew: copy.icp.createNew, updated: copy.icp.updated, aiTitle: copy.icp.chatWithAI, aiDesc: copy.icp.chatDesc, quickEntry: copy.icp.quickEntry, quickDesc: copy.icp.quickDesc }} icpProfiles={icpProfiles} newIcpDescription={newIcpDescription} newIcpName={newIcpName} selectedIcpId={completed.icp?.id ?? null} onCreateQuick={onCreateIcpQuick} onDescriptionChange={onIcpDescriptionChange} onNameChange={onIcpNameChange} onOpenAiChat={onOpenAiChat} onSelectIcp={onSelectIcp} />;
    case 'hypothesis':
      return <LegacyHypothesisStep aiLoading={aiLoading} colors={colors} copy={{ lockedTitle: copy.locked.title, lockedSubtitle: copy.locked.subtitle, title: copy.hypothesis.title, subtitle: copy.hypothesis.subtitle, suggested: copy.hypothesis.suggested, confidence: copy.hypothesis.confidence, aiTitle: copy.icp.chatWithAI, chatDesc: copy.hypothesis.chatDesc, writeHyp: copy.hypothesis.writeHyp, writeDesc: copy.hypothesis.writeDesc }} hasIcp={Boolean(completed.icp)} hypotheses={hypotheses} icpName={completed.icp?.name ?? null} newHypothesisLabel={newHypothesisLabel} selectedHypothesisId={completed.hypothesis?.id ?? null} onCreateQuick={onCreateHypothesisQuick} onOpenAiChat={onOpenAiChat} onQuickLabelChange={onHypothesisLabelChange} onSelectHypothesis={onSelectHypothesis} />;
    case 'segment':
      return <LegacySegmentStep colors={colors} companiesLabel={copy.icp.companies} copy={{ lockedTitle: copy.locked.title, lockedSubtitle: copy.locked.subtitle, title: copy.segment.title, subtitle: copy.segment.subtitle, hypothesis: copy.segment.hypothesis, matching: copy.segment.matching, source: copy.segment.source, generateNew: copy.segment.generateNew, searchDB: copy.segment.searchDB, searchDesc: copy.segment.searchDesc, exaSearch: copy.segment.exaSearch, exaDesc: copy.segment.exaDesc }} discoveryStatus={discoveryStatus} hasHypothesis={Boolean(completed.hypothesis)} hasPersistedDiscoveryRun={hasPersistedDiscoveryRun} onOpenDiscovery={onOpenDiscovery} onOpenExaSearch={onOpenExaSearch} onOpenSegmentBuilder={onOpenSegmentBuilder} onSelectSegment={onSelectSegment} segments={segments} selectionSummary={{ icp: completed.icp?.name ?? completed.icp?.id ?? null, hypothesis: completed.hypothesis?.hypothesis_label ?? completed.hypothesis?.text ?? completed.hypothesis?.id ?? null, selectedSegmentId: completed.segment?.id ?? null }} />;
    case 'enrichment':
      return <LegacyEnrichmentStep colors={colors} copy={{ lockedTitle: copy.locked.title, lockedSubtitle: copy.locked.subtitle, title: copy.enrichment.title, subtitle: copy.enrichment.subtitle, from: copy.enrichment.from, optional: copy.enrichment.optional, optionalDesc: copy.enrichment.optionalDesc, companyData: copy.enrichment.companyData, companyDesc: copy.enrichment.companyDesc, leadDetails: copy.enrichment.leadDetails, leadDesc: copy.enrichment.leadDesc, webIntel: copy.enrichment.webIntel, webDesc: copy.enrichment.webDesc, enrich: copy.enrichment.enrich, skip: copy.enrichment.skip }} enrichLoading={enrichLoading} enrichResults={enrichResults} enrichStatus={enrichStatus} enrichmentDefaults={enrichmentDefaults} enrichmentPrimarySummary={enrichmentPrimarySummary} hasSegment={Boolean(completed.segment)} isProviderReady={isProviderReady} providerOptions={providerOptions} segmentSummary={completed.segment ? { name: completed.segment.name ?? completed.segment.id ?? '', source: completed.segment.source ?? '' } : null} selectedProviders={selectedProviders} onEnrich={onEnrich} onProviderToggle={onProviderToggle} onResetToDefaults={onResetProviders} onSkip={onSkipEnrichment} />;
    case 'draft':
      return <LegacyDraftStep campaignCreateBusy={campaignCreateBusy} campaignCreateError={campaignCreateError} campaigns={campaigns} colors={colors} copy={{ lockedTitle: copy.locked.title, lockedSubtitle: copy.locked.subtitle, draftLabel: copy.steps.draft.label, segmentSubtitleLabel: copy.segment.subtitle, hypothesisLabel: copy.segment.hypothesis, segmentLabel: copy.steps.segment.label }} dataQualityMode={dataQualityMode} draftDryRun={draftDryRun} draftLimit={draftLimit} draftLoading={draftLoading} draftSummary={draftSummary} hasSegment={Boolean(completed.segment)} interactionMode={interactionMode} newCampaignName={newCampaignName} selectedCampaignId={selectedCampaignId} selectionSummary={{ icp: completed.icp?.name ?? completed.icp?.id ?? null, hypothesis: completed.hypothesis?.hypothesis_label ?? completed.hypothesis?.text ?? completed.hypothesis?.id ?? null, segment: completed.segment?.name ?? completed.segment?.id ?? null }} onCampaignChange={onCampaignChange} onCreateCampaign={onCreateCampaign} onDataQualityModeChange={onDataQualityModeChange} onDraftDryRunChange={onDraftDryRunChange} onDraftLimitChange={onDraftLimitChange} onGenerateDrafts={onGenerateDrafts} onInteractionModeChange={onInteractionModeChange} onNewCampaignNameChange={onNewCampaignNameChange} />;
    case 'send':
      return <LegacySendStep campaigns={campaigns} colors={colors} copy={{ lockedTitle: copy.locked.title, lockedSubtitle: copy.locked.subtitle, notSelected: copy.notSelected, sendLabel: copy.steps.send.label }} hasDraft={Boolean(completed.draft)} selectedCampaignId={selectedCampaignId} selectedSmartleadCampaignId={selectedSmartleadCampaignId} sendBatchSize={sendBatchSize} sendDryRun={sendDryRun} sendLoading={sendLoading} sendSummary={sendSummary} smartleadCampaigns={smartleadCampaigns} smartleadReady={smartleadReady} onBatchSizeChange={onBatchSizeChange} onDryRunChange={onSendDryRunChange} onPrepare={onPrepareSend} onSmartleadCampaignChange={onSmartleadCampaignChange} />;
    default:
      return (
        <div style={{ textAlign: 'center', padding: '80px 40px' }}>
          <div style={{ fontSize: '18px', fontWeight: 600, color: colors.textMuted, marginBottom: '8px' }}>{copy.locked.title}</div>
          <div style={{ fontSize: '14px', color: colors.textMuted }}>{copy.locked.subtitle}</div>
        </div>
      );
  }
}

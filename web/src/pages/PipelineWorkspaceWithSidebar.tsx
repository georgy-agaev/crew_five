// @ts-nocheck
import { useEffect, useState } from 'react';

import {
  fetchServices,
  fetchIcpProfiles,
  fetchIcpHypotheses,
  fetchSegments,
  fetchCampaigns,
  fetchSmartleadCampaigns,
  triggerDraftGenerate,
  triggerSmartleadPreview,
  enqueueSegmentEnrichment,
  fetchEnrichmentStatus,
  triggerIcpDiscovery,
  generateIcpProfileViaCoach,
  generateHypothesisViaCoach,
  createIcpProfile,
  createIcpHypothesis,
  fetchPromptRegistry,
  createPromptRegistryEntry,
  setActivePrompt,
  fetchAnalyticsSummary,
  fetchAnalyticsOptimize,
  type ServiceConfig,
  type PromptEntry,
  type PromptStep,
  fetchLlmModels,
  createSegmentAPI,
  saveExaSegmentAPI,
} from '../apiClient';
import { SegmentBuilder } from '../components/SegmentBuilder';
import { ExaWebsetSearch } from '../components/ExaWebsetSearch';
import { loadSettings, saveSettings, type Settings } from '../hooks/useSettingsStore';
import { getRecommendedModels, type ModelEntry } from '../../../src/config/modelCatalog';

export function formatDraftSummary(params: {
  generated: number;
  dryRun: boolean;
  dataQualityMode: 'strict' | 'graceful';
  interactionMode: 'express' | 'coach';
}) {
  return `Drafts ready: generated=${params.generated}, dryRun=${params.dryRun}, modes=${params.dataQualityMode}/${params.interactionMode}`;
}

export function formatAnalyticsGroupKey(
  groupBy: 'icp' | 'segment' | 'pattern',
  row: Record<string, any>
) {
  if (groupBy === 'segment') {
    return `${row.segment_id ?? 'n/a'}@v${row.segment_version ?? 'n/a'} (${row.role ?? 'any'})`;
  }
  if (groupBy === 'pattern') {
    return `${row.draft_pattern ?? 'unknown'} [edited=${row.user_edited ?? false}]`;
  }
  return `${row.icp_profile_id ?? 'n/a'} / ${row.icp_hypothesis_id ?? 'n/a'}`;
}

export function formatSendSummary(
  result: { fetched?: number; sent?: number; skipped?: number },
  truncated?: number
) {
  const base = `Smartlead preview: fetched=${result.fetched ?? 0}, sent=${result.sent ?? 0}, skipped=${result.skipped ?? 0}`;
  return truncated && truncated > 0 ? `${base} (truncated preview by ${truncated})` : base;
}

export function getPromptStatusKey(entry: { is_active?: boolean; rollout_status?: string | null }) {
  if (entry.is_active) return 'active';
  if (entry.rollout_status === 'active') return 'active';
  if (entry.rollout_status === 'pilot') return 'pilot';
  if (entry.rollout_status === 'retired') return 'retired';
  return '';
}

export type TaskKey = 'icpDiscovery' | 'hypothesisGen' | 'emailDraft' | 'linkedinMsg';

export type TaskPromptsState = {
  icpDiscovery?: string;
  hypothesisGen?: string;
  emailDraft?: string;
  linkedinMsg?: string;
};

export type ProviderTaskKey = 'assistant' | 'icp' | 'hypothesis' | 'draft';

export function getPromptOptions(entries: PromptEntry[]) {
  return (entries ?? []).map((entry) => {
    const versionLabel = entry.version ? ` (${entry.version})` : '';
    return {
      value: entry.id,
      label: `${entry.id}${versionLabel}`,
    };
  });
}

export function setTaskPrompt(
  prev: TaskPromptsState,
  task: TaskKey,
  promptId: string | undefined
): TaskPromptsState {
  return {
    ...prev,
    [task]: promptId || undefined,
  };
}

export function getTaskSelectionLabel(taskPrompts: TaskPromptsState, task: TaskKey): string | null {
  const value = taskPrompts?.[task];
  return value ?? null;
}

export function mapTaskToProviderKey(task: TaskKey): ProviderTaskKey {
  if (task === 'icpDiscovery') return 'icp';
  if (task === 'hypothesisGen') return 'hypothesis';
  return 'draft';
}

const modelCatalog: ModelEntry[] = getRecommendedModels();

export function getModelOptionsForProvider(
  provider: string,
  llmModels: Record<string, string[] | undefined>
) {
  const live = llmModels[provider];
  if (live && live.length) {
    const unique = Array.from(new Set(live));
    const recommended = new Set(
      modelCatalog.filter((m) => m.provider === provider && m.recommended).map((m) => m.model)
    );
    const ordered = [
      ...unique.filter((id) => recommended.has(id)),
      ...unique.filter((id) => !recommended.has(id)),
    ];
    return ordered.map((id) => ({ value: id, label: id }));
  }

  // Fallback when live model list is not available: use catalog models for provider.
  return modelCatalog
    .filter((entry) => entry.provider === provider)
    .map((entry) => ({
      value: entry.model,
      label: entry.model,
    }));
}

export function mapTaskToPromptStep(task: TaskKey): PromptStep | null {
  if (task === 'icpDiscovery') return 'icp_profile';
  if (task === 'hypothesisGen') return 'icp_hypothesis';
  if (task === 'emailDraft') return 'draft';
  return null;
}

export function getPromptOptionsForStep(entries: PromptEntry[], step: PromptStep) {
  return entries
    .filter((entry) => entry.step === step)
    .map((entry) => {
      const versionLabel = entry.version ? ` (${entry.version})` : '';
      return {
        value: entry.id,
        label: `${entry.id}${versionLabel}`,
      };
    });
}

export async function applyActivePromptSelection(
  step: PromptStep | null,
  coachPromptId: string,
  deps: {
    setActivePromptApi: (step: PromptStep, coachPromptId: string) => Promise<void>;
    fetchPromptRegistryApi: () => Promise<PromptEntry[]>;
  }
): Promise<PromptEntry[] | null> {
  if (!step || !coachPromptId) return null;
  await deps.setActivePromptApi(step, coachPromptId);
  const rows = await deps.fetchPromptRegistryApi();
  return rows;
}

export function aggregateAnalyticsMetrics(
  rows: Array<{ delivered?: number; opened?: number; replied?: number; positive_replies?: number }>
) {
  return rows.reduce(
    (acc, row) => ({
      delivered: acc.delivered + (row.delivered ?? 0),
      opened: acc.opened + (row.opened ?? 0),
      replied: acc.replied + (row.replied ?? 0),
      positive: acc.positive + (row.positive_replies ?? 0),
    }),
    { delivered: 0, opened: 0, replied: 0, positive: 0 }
  );
}

export function getActivePromptIdForStep(
  entries: Array<{ id: string; step?: PromptStep; is_active?: boolean; rollout_status?: string | null }>,
  step: PromptStep
) {
  const match = entries.find((entry) => {
    if (entry.step !== step) return false;
    const statusKey = getPromptStatusKey(entry);
    return statusKey === 'active';
  });
  return match?.id ?? null;
}

export function appendInteractiveCoachMessage(messages: any[] | null | undefined, message: any) {
  const base = Array.isArray(messages) ? messages : [];
  const enriched = {
    ...message,
    step: message.step,
    entityId: message.entityId,
  };
  const next = appendChatMessage(base, enriched);
  const windowSize = 8;
  return next.slice(-windowSize);
}

export function buildInteractiveIcpPrompt(summary: any | null, userInput: string) {
  if (!summary) return userInput;
  const summaryText = formatIcpSummaryForChat(summary);
  if (!summaryText) return userInput;
  return [
    'Current ICP summary:',
    summaryText,
    '',
    'New input from user:',
    userInput,
  ].join('\n');
}

export function buildInteractiveHypothesisPrompt(summary: any | null, userInput: string) {
  if (!summary) return userInput;
  const summaryText = formatHypothesisSummaryForChat(summary);
  if (!summaryText) return userInput;
  return [
    'Current hypothesis summary:',
    summaryText,
    '',
    'New input from user:',
    userInput,
  ].join('\n');
}

const DISCOVERY_STORAGE_KEY = 'c5_latest_icp_discovery';

export function persistLatestDiscoveryRun(meta: {
  runId: string;
  icpProfileId?: string | null;
  icpHypothesisId?: string | null;
}) {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(DISCOVERY_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // best-effort only; ignore storage errors
  }
}

export function getPersistedDiscoveryRun():
  | { runId: string; icpProfileId?: string | null; icpHypothesisId?: string | null }
  | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  const raw = window.sessionStorage.getItem(DISCOVERY_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.runId !== 'string') return null;
    return {
      runId: parsed.runId,
      icpProfileId: parsed.icpProfileId ?? null,
      icpHypothesisId: parsed.icpHypothesisId ?? null,
    };
  } catch {
    return null;
  }
}

export function hasPersistedDiscoveryRun() {
  const meta = getPersistedDiscoveryRun();
  return !!meta?.runId;
}

export function buildDiscoveryLinkParams(meta: {
  runId: string;
  icpProfileId?: string | null;
  icpHypothesisId?: string | null;
}) {
  return {
    view: 'icp-discovery',
    runId: meta.runId,
    icpId: meta.icpProfileId ?? '',
    hypothesisId: meta.icpHypothesisId ?? '',
  };
}

export function openIcpDiscoveryForLatestRun() {
  const meta = getPersistedDiscoveryRun();
  if (!meta?.runId || typeof window === 'undefined' || !window.location) return;
  const params = buildDiscoveryLinkParams(meta);
  const search = new URLSearchParams(params as any).toString();
  const base = window.location.href.split('?')[0];
  window.location.assign(`${base}?${search}`);
}

export function buildPromptCreateEntry(form: {
  id: string;
  version?: string;
  description?: string;
  rollout_status?: 'pilot' | 'active' | 'retired' | 'deprecated' | null;
  prompt_text?: string;
}) {
  const trimmedId = (form.id ?? '').trim();
  return {
    id: trimmedId,
    version: form.version ? form.version.trim() : undefined,
    description: form.description ? form.description.trim() : undefined,
    rollout_status: form.rollout_status ?? 'pilot',
    prompt_text: form.prompt_text && form.prompt_text.trim().length > 0 ? form.prompt_text.trim() : undefined,
  };
}

export function mapEnrichmentErrorMessage(err: unknown): string {
  const raw =
    (err as any)?.message ??
    (typeof err === 'string' ? err : '') ??
    '';
  if (
    typeof raw === 'string' &&
    raw.includes('No segment members found for finalized segment')
  ) {
    return 'Selected segment has no finalized members yet. Create or refresh a snapshot (or add members) before running enrichment.';
  }
  return raw || 'Failed to enqueue enrichment';
}

export function mapLlmModelsErrorMessage(err: unknown): string {
  const raw =
    (err as any)?.message ??
    (typeof err === 'string' ? err : '') ??
    '';
  if (!raw) {
    return 'Failed to list models';
  }
  const match = /^API error \d+:\s*(.*)$/.exec(raw);
  if (match && match[1]) {
    return match[1];
  }
  return raw;
}

export function formatIcpSummaryForChat(summary: any) {
  if (!summary) return '';
  const parts: string[] = [];
  if (summary.valueProp) {
    parts.push(`Value prop: ${summary.valueProp}`);
  }
  if (summary.industries && summary.industries.length) {
    let text = `Target industries: ${summary.industries.join(', ')}`;
    if (summary.companySizes && summary.companySizes.length) {
      text += ` (${summary.companySizes.join(', ')})`;
    }
    parts.push(text);
  }
  if (summary.pains && summary.pains.length) {
    parts.push(`Key pains: ${summary.pains.join(', ')}`);
  }
  if (summary.triggers && summary.triggers.length) {
    parts.push(`Buying triggers: ${summary.triggers.join(', ')}`);
  }
  return parts.join(' · ');
}

export function formatHypothesisSummaryForChat(summary: any) {
  if (!summary) return '';
  const parts: string[] = [];
  if (summary.label) {
    parts.push(`Hypothesis: ${summary.label}`);
  }
  if (summary.regions && summary.regions.length) {
    parts.push(`Regions: ${summary.regions.join(', ')}`);
  }
  if (summary.offers && summary.offers.length) {
    const first = summary.offers[0] || {};
    const offerLabel = first.personaRole ? `${first.personaRole}: ${first.offer}` : first.offer;
    if (offerLabel) {
      parts.push(`Offer: ${offerLabel}`);
    }
  }
  if (summary.critiques && summary.critiques.length) {
    const firstCrit = summary.critiques[0] || {};
    const critiqueText = firstCrit.roast || firstCrit.suggestion;
    if (critiqueText) {
      parts.push(`Critique: ${critiqueText}`);
    }
  }
  return parts.join(' · ');
}

export function appendChatMessage(messages: any[] | null | undefined, message: any) {
  const base = Array.isArray(messages) ? messages : [];
  return [...base, message];
}

export function buildIcpSummaryFromProfile(profile: any) {
  if (!profile) return null;
  const company = (profile as any).company_criteria ?? {};
  const persona = (profile as any).persona_criteria ?? {};
  const phases = (profile as any).phase_outputs ?? {};
  const phase1 = phases.phase1 ?? {};
  const phase2 = phases.phase2 ?? {};
  const phase3 = phases.phase3 ?? {};

  const valueProp = phase1.valueProp ?? company.valueProp ?? null;

  const industries =
    (phase2.industryAndSize && phase2.industryAndSize.industries) ||
    company.industries ||
    [];
  const companySizes =
    (phase2.industryAndSize && phase2.industryAndSize.companySizes) ||
    company.companySizes ||
    [];

  const pains = phase2.pains || company.pains || [];
  const decisionMakers = phase2.decisionMakers || persona.decisionMakers || [];

  const triggers = phase3.triggers || company.triggers || [];
  const dataSources = phase3.dataSources || company.dataSources || [];

  return {
    valueProp,
    industries,
    companySizes,
    pains,
    decisionMakers,
    triggers,
    dataSources,
  };
}

export function buildHypothesisSummaryFromSearchConfig(hypothesis: any) {
  if (!hypothesis) {
    return {
      label: '',
      regions: [],
      offers: [],
      critiques: [],
    };
  }
  const searchConfig = (hypothesis as any).search_config ?? {};
  const phases = searchConfig.phases ?? {};
  const phase4 = phases.phase4 ?? {};
  const phase5 = phases.phase5 ?? {};
  const offers = phase4.offers || [];
  const critiques = phase5.critiques || [];
  const regions = searchConfig.region || [];
  const label =
    (hypothesis as any).hypothesis_label ??
    (hypothesis as any).hypothesisLabel ??
    '';

  return {
    label,
    regions,
    offers,
    critiques,
  };
}

export type CoachRunMode = 'create' | 'refine';

export function resolveCoachRunMode(
  currentStep: string,
  completed: { icp?: any; hypothesis?: any },
  preferredMode?: CoachRunMode | null
): CoachRunMode {
  if (preferredMode === 'create' || preferredMode === 'refine') {
    return preferredMode;
  }
  if (currentStep === 'icp') {
    return completed?.icp?.id ? 'refine' : 'create';
  }
  if (currentStep === 'hypothesis') {
    return completed?.hypothesis?.id ? 'refine' : 'create';
  }
  return 'create';
}

export function applyCoachResultToState(
  mode: CoachRunMode,
  entity: 'icp' | 'hypothesis',
  result: any,
  profiles: any[],
  hypotheses: any[],
  completed: { icp?: any; hypothesis?: any }
): { profiles: any[]; hypotheses: any[] } {
  if (entity === 'icp') {
    const existing = Array.isArray(profiles) ? profiles : [];
    if (mode === 'refine' && completed.icp?.id) {
      return {
        profiles: [result, ...existing.filter((p: any) => p?.id !== completed.icp.id)],
        hypotheses,
      };
    }
    return {
      profiles: [result, ...existing],
      hypotheses,
    };
  }

  const existingHyps = Array.isArray(hypotheses) ? hypotheses : [];
  if (mode === 'refine' && completed.hypothesis?.id) {
    return {
      profiles,
      hypotheses: [result, ...existingHyps.filter((h: any) => h?.id !== completed.hypothesis.id)],
    };
  }
  return {
    profiles,
    hypotheses: [result, ...existingHyps],
  };
}

/**
 * GTM Workspace with Left Sidebar Navigation (Option B)
 * Main navigation: Pipeline | Inbox | Analytics
 * Supports: English, Spanish, French, German, Russian
 */

type PipelineWorkspaceProps = {
  apiBase: string;
  modeLabel: string;
  supabaseReady: boolean;
  smartleadReady: boolean;
};

	export default function PipelineWorkspaceWithSidebar({
  apiBase,
  modeLabel,
  supabaseReady,
  smartleadReady,
}: PipelineWorkspaceProps) {
  const [isDark, setIsDark] = useState(false);
  const [currentPage, setCurrentPage] = useState<'pipeline' | 'inbox' | 'analytics' | 'promptRegistry'>('pipeline'); // pipeline | inbox | analytics
  const [currentStep, setCurrentStep] = useState('icp');
  const [showAIChat, setShowAIChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showServices, setShowServices] = useState(false);
  const [showSegmentBuilder, setShowSegmentBuilder] = useState(false);
  const [showExaWebsetSearch, setShowExaWebsetSearch] = useState(false);
  const [language, setLanguage] = useState('en');
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false); // true = wide (240px), false = narrow (72px)
  
  // Simulated state - tracks what user has completed
  const [completed, setCompleted] = useState({
    icp: null,
    hypothesis: null,
    segment: null,
    enrichment: false,
    draft: null,
    sim: null,
  });

  const [services, setServices] = useState<ServiceConfig[]>([]);
  const [icpProfiles, setIcpProfiles] = useState<any[]>([]);
  const [hypotheses, setHypotheses] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [aiMessage, setAiMessage] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [newIcpName, setNewIcpName] = useState('');
  const [newIcpDescription, setNewIcpDescription] = useState('');
  const [newHypothesisLabel, setNewHypothesisLabel] = useState('');
  const [discoveryStatus, setDiscoveryStatus] = useState<string | null>(null);
  const [enrichStatus, setEnrichStatus] = useState<string | null>(null);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [draftLimit, setDraftLimit] = useState<number>(50);
  const [dataQualityMode, setDataQualityMode] = useState<'strict' | 'graceful'>('strict');
  const [interactionMode, setInteractionMode] = useState<'express' | 'coach'>('express');
  const [draftSummary, setDraftSummary] = useState<string | null>(null);
  const [smartleadCampaigns, setSmartleadCampaigns] = useState<any[]>([]);
  const [selectedSmartleadCampaignId, setSelectedSmartleadCampaignId] = useState<string>('');
  const [sendSummary, setSendSummary] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [promptEntries, setPromptEntries] = useState<PromptEntry[]>([]);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [taskPrompts, setTaskPrompts] = useState<TaskPromptsState>(() => {
    return (settings.taskPrompts ?? {}) as TaskPromptsState;
  });
  const [promptFilterStatus, setPromptFilterStatus] = useState<'all' | 'active' | 'pilot' | 'retired'>('all');
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [showPromptCreate, setShowPromptCreate] = useState(false);
  const [promptCreateForm, setPromptCreateForm] = useState({
    id: '',
    step: 'draft' as PromptStep,
    version: 'v1',
    description: '',
    rollout_status: 'pilot' as any,
    prompt_text: '',
  });
  const [analyticsRows, setAnalyticsRows] = useState<any[]>([]);
  const [analyticsSuggestions, setAnalyticsSuggestions] = useState<any[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsGroupBy, setAnalyticsGroupBy] = useState<'icp' | 'segment' | 'pattern'>('icp');
  const [inboxMessages, setInboxMessages] = useState<any[]>([]);
  const [inboxFilter, setInboxFilter] = useState<'unread' | 'all' | 'starred'>('unread');
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [llmModels, setLlmModels] = useState<Record<string, string[] | undefined>>({});
  const [llmModelsError, setLlmModelsError] = useState<Record<string, string | undefined>>({});
  const [aiTranscript, setAiTranscript] = useState<any[]>([]);

  useEffect(() => {
    const providers: Array<'openai' | 'anthropic'> = ['openai', 'anthropic'];
    providers.forEach((provider) => {
      if (llmModels[provider] || llmModelsError[provider]) return;
      fetchLlmModels(provider)
        .then((models) => {
          const ids = (models ?? []).map((m) => m.id).filter(Boolean);
          setLlmModels((prev) => ({ ...prev, [provider]: ids }));
        })
        .catch((err: any) => {
          setLlmModelsError((prev) => ({
            ...prev,
            [provider]: mapLlmModelsErrorMessage(err),
          }));
        });
    });
  }, [llmModels, llmModelsError]);

  // Comprehensive translations
  const translations = {
    en: {
      hero: {
        title1: 'Turn prospects into ',
        title2: 'pipeline-ready',
        title3: ' conversations',
        subtitle: 'Power your GTM with AI-driven workflows. From ICP discovery to inbox management.',
      },
      title: 'GTM Pipeline',
      inbox: 'Inbox',
      analytics: 'Analytics',
      promptRegistry: 'Prompt Registry',
      navPipeline: 'Pipeline',
      navInbox: 'Inbox',
      navAnalytics: 'Analytics',
      navPromptRegistry: 'Prompts',
      collapseNav: 'Collapse',
      currentConfig: 'Current Configuration',
      notSelected: 'Not selected',
      settings: 'Settings',
      services: 'Services',
      steps: {
        icp: { label: 'ICP', description: 'Define your Ideal Customer Profile' },
        hypothesis: { label: 'Hypothesis', description: 'Create targeting hypothesis' },
        segment: { label: 'Segment', description: 'Select or generate segments' },
        enrichment: { label: 'Enrich', description: 'Enrich companies and leads' },
        draft: { label: 'Draft', description: 'Generate personalized emails' },
        sim: { label: 'Sim', description: 'Coming Soon', comingSoon: true },
        send: { label: 'Send', description: 'Choose delivery method' },
      },
      icp: {
        title: 'Choose or Create ICP',
        subtitle: 'Start by defining your Ideal Customer Profile. You can choose from existing ICPs or create a new one.',
        chooseExisting: 'Choose Existing',
        createNew: 'Create New',
        companies: 'companies',
        updated: 'Updated',
        chatWithAI: 'Chat with AI',
        chatDesc: 'Describe your ideal customer and let AI help',
        quickEntry: 'Quick Entry',
        quickDesc: 'Enter details directly in a form',
      },
      hypothesis: {
        title: 'Choose or Create Hypothesis',
        subtitle: 'Based on your ICP:',
        suggested: 'Suggested Hypotheses',
        confidence: 'Confidence',
        chatDesc: 'Brainstorm targeting hypotheses together',
        writeHyp: 'Write Hypothesis',
        writeDesc: 'Type your targeting hypothesis directly',
      },
      segment: {
        title: 'Select or Generate Segments',
        subtitle: 'ICP:',
        hypothesis: 'Hypothesis:',
        matching: 'Matching Segments',
        source: 'Source',
        generateNew: 'Generate New',
        searchDB: 'Search Database',
        searchDesc: 'Query your existing company database',
        exaSearch: 'EXA Web Search',
        exaDesc: 'Find new companies from the web',
      },
      enrichment: {
        title: 'Enrich Segment Data',
        subtitle: 'Enriching',
        from: 'from:',
        optional: 'Optional Step',
        optionalDesc: 'Enrichment improves personalization but you can skip this step and proceed directly to drafting if needed.',
        companyData: 'Company Data',
        companyDesc: 'Industry, size, funding, tech stack',
        leadDetails: 'Lead Details',
        leadDesc: 'Contacts, roles, LinkedIn profiles',
        webIntel: 'Web Intelligence',
        webDesc: 'Recent news, hiring, product launches',
        enrich: 'Enrich',
        skip: 'Skip Enrichment →',
      },
      locked: {
        title: 'Complete previous steps',
        subtitle: 'You need to complete the previous steps before accessing this section.',
      },
      aiChat: {
        title: 'AI Assistant',
        greeting: 'Hi! I\'m your AI assistant. I can help you create a new',
        greeting2: 'based on your requirements. Just describe what you\'re looking for and I\'ll guide you through the process.',
        placeholder: 'Type your message...',
        send: 'Send',
      },
      settingsModal: {
        title: 'Settings',
        aiProviders: 'AI Providers',
        taskConfig: 'Task Configuration',
        provider: 'Provider',
        model: 'Model',
        prompt: 'Prompt',
        tasks: {
          icpDiscovery: 'ICP Discovery',
          hypothesisGen: 'Hypothesis Generation',
          emailDraft: 'Email Draft',
          linkedinMsg: 'LinkedIn Message',
        },
      },
      servicesModal: {
        title: 'Services Status',
        categories: {
          database: 'Database',
          llm: 'LLM',
          delivery: 'Delivery',
          enrichment: 'Enrichment',
        },
      },
      inboxPage: {
        title: 'Inbox',
        subtitle: 'Manage your campaign replies and conversations',
        unread: 'Unread',
        all: 'All',
        starred: 'Starred',
        noMessages: 'No messages yet',
        noMessagesDesc: 'When you receive replies from your campaigns, they\'ll appear here.',
      },
      analyticsPage: {
        title: 'Analytics',
        subtitle: 'Track your campaign performance and metrics',
        overview: 'Overview',
        campaigns: 'Campaigns',
        performance: 'Performance',
        noData: 'No data available',
        noDataDesc: 'Start running campaigns to see analytics data here.',
      },
      promptRegistryPage: {
        title: 'Prompt Registry',
        subtitle: 'Manage and optimize your AI prompts across workflows',
        allPrompts: 'All Prompts',
        active: 'Active',
        pilot: 'Pilot',
        retired: 'Retired',
        createNew: 'Create Prompt',
        noPrompts: 'No prompts yet',
        noPromptsDesc: 'Create your first prompt to start optimizing your AI workflows.',
        step: 'Step',
        version: 'Version',
        status: 'Status',
        description: 'Description',
        promptId: 'Prompt ID',
        promptText: 'Prompt Text',
      },
    },
    es: {
      hero: {
        title1: 'Convierte prospectos en conversaciones ',
        title2: 'listas para el pipeline',
        title3: '',
        subtitle: 'Potencia tu GTM con flujos de trabajo impulsados por IA. Desde el descubrimiento de ICP hasta la gestión de bandeja de entrada.',
      },
      title: 'Pipeline GTM',
      inbox: 'Bandeja',
      analytics: 'Analítica',
      navPipeline: 'Pipeline',
      navInbox: 'Bandeja',
      navAnalytics: 'Analítica',
      collapseNav: 'Contraer',
      currentConfig: 'Configuración Actual',
      notSelected: 'No seleccionado',
      settings: 'Configuración',
      services: 'Servicios',
      steps: {
        icp: { label: 'ICP', description: 'Define tu Perfil de Cliente Ideal' },
        hypothesis: { label: 'Hipótesis', description: 'Crear hipótesis de targeting' },
        segment: { label: 'Segmento', description: 'Seleccionar o generar segmentos' },
        enrichment: { label: 'Enriquecer', description: 'Enriquecer empresas y leads' },
        draft: { label: 'Borrador', description: 'Generar emails personalizados' },
        sim: { label: 'Sim', description: 'Próximamente', comingSoon: true },
        send: { label: 'Enviar', description: 'Elegir método de entrega' },
      },
      icp: {
        title: 'Elegir o Crear ICP',
        subtitle: 'Comienza definiendo tu Perfil de Cliente Ideal. Puedes elegir ICPs existentes o crear uno nuevo.',
        chooseExisting: 'Elegir Existente',
        createNew: 'Crear Nuevo',
        companies: 'empresas',
        updated: 'Actualizado',
        chatWithAI: 'Chatear con IA',
        chatDesc: 'Describe tu cliente ideal y deja que la IA ayude',
        quickEntry: 'Entrada Rápida',
        quickDesc: 'Ingresa detalles directamente en un formulario',
      },
      hypothesis: {
        title: 'Elegir o Crear Hipótesis',
        subtitle: 'Basado en tu ICP:',
        suggested: 'Hipótesis Sugeridas',
        confidence: 'Confianza',
        chatDesc: 'Lluvia de ideas sobre hipótesis de targeting',
        writeHyp: 'Escribir Hipótesis',
        writeDesc: 'Escribe tu hipótesis de targeting directamente',
      },
      segment: {
        title: 'Seleccionar o Generar Segmentos',
        subtitle: 'ICP:',
        hypothesis: 'Hipótesis:',
        matching: 'Segmentos Coincidentes',
        source: 'Fuente',
        generateNew: 'Generar Nuevo',
        searchDB: 'Buscar en Base de Datos',
        searchDesc: 'Consulta tu base de datos de empresas existente',
        exaSearch: 'Búsqueda Web EXA',
        exaDesc: 'Encuentra nuevas empresas en la web',
      },
      enrichment: {
        title: 'Enriquecer Datos del Segmento',
        subtitle: 'Enriqueciendo',
        from: 'de:',
        optional: 'Paso Opcional',
        optionalDesc: 'El enriquecimiento mejora la personalización pero puedes omitir este paso y proceder directamente al borrador si es necesario.',
        companyData: 'Datos de Empresa',
        companyDesc: 'Industria, tamaño, financiación, stack tecnológico',
        leadDetails: 'Detalles de Lead',
        leadDesc: 'Contactos, roles, perfiles de LinkedIn',
        webIntel: 'Inteligencia Web',
        webDesc: 'Noticias recientes, contrataciones, lanzamientos de productos',
        enrich: 'Enriquecer',
        skip: 'Omitir Enriquecimiento →',
      },
      locked: {
        title: 'Completa los pasos anteriores',
        subtitle: 'Necesitas completar los pasos anteriores antes de acceder a esta sección.',
      },
      aiChat: {
        title: 'Asistente IA',
        greeting: '¡Hola! Soy tu asistente de IA. Puedo ayudarte a crear un nuevo',
        greeting2: 'basado en tus requisitos. Solo describe lo que buscas y te guiaré en el proceso.',
        placeholder: 'Escribe tu mensaje...',
        send: 'Enviar',
      },
      settingsModal: {
        title: 'Configuración',
        aiProviders: 'Proveedores de IA',
        taskConfig: 'Configuración de Tareas',
        provider: 'Proveedor',
        model: 'Modelo',
        prompt: 'Prompt',
        tasks: {
          icpDiscovery: 'Descubrimiento de ICP',
          hypothesisGen: 'Generación de Hipótesis',
          emailDraft: 'Borrador de Email',
          linkedinMsg: 'Mensaje de LinkedIn',
        },
      },
      servicesModal: {
        title: 'Estado de Servicios',
        categories: {
          database: 'Base de Datos',
          llm: 'LLM',
          delivery: 'Entrega',
          enrichment: 'Enriquecimiento',
        },
      },
      inboxPage: {
        title: 'Bandeja de Entrada',
        subtitle: 'Gestiona las respuestas y conversaciones de tus campañas',
        unread: 'No Leídos',
        all: 'Todos',
        starred: 'Destacados',
        noMessages: 'Aún no hay mensajes',
        noMessagesDesc: 'Cuando recibas respuestas de tus campañas, aparecerán aquí.',
      },
      analyticsPage: {
        title: 'Analítica',
        subtitle: 'Rastrea el rendimiento y métricas de tus campañas',
        overview: 'Resumen',
        campaigns: 'Campañas',
        performance: 'Rendimiento',
        noData: 'No hay datos disponibles',
        noDataDesc: 'Comienza a ejecutar campañas para ver datos analíticos aquí.',
      },
      promptRegistryPage: {
        title: 'Registro de Prompts',
        subtitle: 'Gestiona y optimiza tus prompts de IA en todos los flujos de trabajo',
        allPrompts: 'Todos los Prompts',
        active: 'Activo',
        pilot: 'Piloto',
        retired: 'Retirado',
        createNew: 'Crear Prompt',
        noPrompts: 'Aún no hay prompts',
        noPromptsDesc: 'Crea tu primer prompt para comenzar a optimizar tus flujos de trabajo de IA.',
        step: 'Paso',
        version: 'Versión',
        status: 'Estado',
        description: 'Descripción',
        promptId: 'ID de Prompt',
        promptText: 'Texto del Prompt',
      },
    },
    fr: {
      hero: {
        title1: 'Transformez les prospects en conversations ',
        title2: 'prêtes pour le pipeline',
        title3: '',
        subtitle: 'Dynamisez votre GTM avec des flux de travail pilotés par l\'IA. De la découverte d\'ICP à la gestion de la boîte de réception.',
      },
      title: 'Pipeline GTM',
      inbox: 'Boîte de Réception',
      analytics: 'Analytique',
      navPipeline: 'Pipeline',
      navInbox: 'Boîte de Réception',
      navAnalytics: 'Analytique',
      collapseNav: 'Réduire',
      currentConfig: 'Configuration Actuelle',
      notSelected: 'Non sélectionné',
      settings: 'Paramètres',
      services: 'Services',
      steps: {
        icp: { label: 'ICP', description: 'Définir votre Profil Client Idéal' },
        hypothesis: { label: 'Hypothèse', description: 'Créer une hypothèse de ciblage' },
        segment: { label: 'Segment', description: 'Sélectionner ou générer des segments' },
        enrichment: { label: 'Enrichir', description: 'Enrichir les entreprises et leads' },
        draft: { label: 'Brouillon', description: 'Générer des emails personnalisés' },
        sim: { label: 'Sim', description: 'Bientôt Disponible', comingSoon: true },
        send: { label: 'Envoyer', description: 'Choisir la méthode de livraison' },
      },
      icp: {
        title: 'Choisir ou Créer un ICP',
        subtitle: 'Commencez par définir votre Profil Client Idéal. Vous pouvez choisir parmi les ICP existants ou en créer un nouveau.',
        chooseExisting: 'Choisir Existant',
        createNew: 'Créer Nouveau',
        companies: 'entreprises',
        updated: 'Mis à jour',
        chatWithAI: 'Discuter avec l\'IA',
        chatDesc: 'Décrivez votre client idéal et laissez l\'IA vous aider',
        quickEntry: 'Saisie Rapide',
        quickDesc: 'Entrez les détails directement dans un formulaire',
      },
      hypothesis: {
        title: 'Choisir ou Créer une Hypothèse',
        subtitle: 'Basé sur votre ICP:',
        suggested: 'Hypothèses Suggérées',
        confidence: 'Confiance',
        chatDesc: 'Brainstorming d\'hypothèses de ciblage ensemble',
        writeHyp: 'Écrire l\'Hypothèse',
        writeDesc: 'Tapez votre hypothèse de ciblage directement',
      },
      segment: {
        title: 'Sélectionner ou Générer des Segments',
        subtitle: 'ICP:',
        hypothesis: 'Hypothèse:',
        matching: 'Segments Correspondants',
        source: 'Source',
        generateNew: 'Générer Nouveau',
        searchDB: 'Rechercher dans la Base de Données',
        searchDesc: 'Interrogez votre base de données d\'entreprises existante',
        exaSearch: 'Recherche Web EXA',
        exaDesc: 'Trouvez de nouvelles entreprises sur le web',
      },
      enrichment: {
        title: 'Enrichir les Données du Segment',
        subtitle: 'Enrichissement',
        from: 'de:',
        optional: 'Étape Optionnelle',
        optionalDesc: 'L\'enrichissement améliore la personnalisation mais vous pouvez ignorer cette étape et passer directement au brouillon si nécessaire.',
        companyData: 'Données d\'Entreprise',
        companyDesc: 'Industrie, taille, financement, stack technologique',
        leadDetails: 'Détails du Lead',
        leadDesc: 'Contacts, rôles, profils LinkedIn',
        webIntel: 'Intelligence Web',
        webDesc: 'Actualités récentes, recrutements, lancements de produits',
        enrich: 'Enrichir',
        skip: 'Ignorer l\'Enrichissement →',
      },
      locked: {
        title: 'Complétez les étapes précédentes',
        subtitle: 'Vous devez compléter les étapes précédentes avant d\'accéder à cette section.',
      },
      aiChat: {
        title: 'Assistant IA',
        greeting: 'Bonjour! Je suis votre assistant IA. Je peux vous aider à créer un nouveau',
        greeting2: 'basé sur vos exigences. Décrivez simplement ce que vous cherchez et je vous guiderai tout au long du processus.',
        placeholder: 'Tapez votre message...',
        send: 'Envoyer',
      },
      settingsModal: {
        title: 'Paramètres',
        aiProviders: 'Fournisseurs d\'IA',
        taskConfig: 'Configuration des Tâches',
        provider: 'Fournisseur',
        model: 'Modèle',
        prompt: 'Prompt',
        tasks: {
          icpDiscovery: 'Découverte d\'ICP',
          hypothesisGen: 'Génération d\'Hypothèse',
          emailDraft: 'Brouillon d\'Email',
          linkedinMsg: 'Message LinkedIn',
        },
      },
      servicesModal: {
        title: 'État des Services',
        categories: {
          database: 'Base de Données',
          llm: 'LLM',
          delivery: 'Livraison',
          enrichment: 'Enrichissement',
        },
      },
      inboxPage: {
        title: 'Boîte de Réception',
        subtitle: 'Gérez les réponses et conversations de vos campagnes',
        unread: 'Non Lus',
        all: 'Tous',
        starred: 'Favoris',
        noMessages: 'Pas encore de messages',
        noMessagesDesc: 'Lorsque vous recevrez des réponses de vos campagnes, elles apparaîtront ici.',
      },
      analyticsPage: {
        title: 'Analytique',
        subtitle: 'Suivez les performances et métriques de vos campagnes',
        overview: 'Aperçu',
        campaigns: 'Campagnes',
        performance: 'Performance',
        noData: 'Aucune donnée disponible',
        noDataDesc: 'Lancez des campagnes pour voir les données analytiques ici.',
      },
      promptRegistryPage: {
        title: 'Registre des Prompts',
        subtitle: 'Gérez et optimisez vos prompts IA dans tous les flux de travail',
        allPrompts: 'Tous les Prompts',
        active: 'Actif',
        pilot: 'Pilote',
        retired: 'Retiré',
        createNew: 'Créer Prompt',
        noPrompts: 'Pas encore de prompts',
        noPromptsDesc: 'Créez votre premier prompt pour commencer à optimiser vos flux de travail IA.',
        step: 'Étape',
        version: 'Version',
        status: 'Statut',
        description: 'Description',
        promptId: 'ID du Prompt',
        promptText: 'Texte du Prompt',
      },
    },
    de: {
      hero: {
        title1: 'Verwandeln Sie Interessenten in ',
        title2: 'pipeline-bereite',
        title3: ' Gespräche',
        subtitle: 'Stärken Sie Ihr GTM mit KI-gesteuerten Workflows. Von der ICP-Entdeckung bis zur Posteingang-Verwaltung.',
      },
      title: 'GTM Pipeline',
      inbox: 'Posteingang',
      analytics: 'Analytik',
      navPipeline: 'Pipeline',
      navInbox: 'Posteingang',
      navAnalytics: 'Analytik',
      collapseNav: 'Einklappen',
      currentConfig: 'Aktuelle Konfiguration',
      notSelected: 'Nicht ausgewählt',
      settings: 'Einstellungen',
      services: 'Dienste',
      steps: {
        icp: { label: 'ICP', description: 'Definieren Sie Ihr ideales Kundenprofil' },
        hypothesis: { label: 'Hypothese', description: 'Targeting-Hypothese erstellen' },
        segment: { label: 'Segment', description: 'Segmente auswählen oder generieren' },
        enrichment: { label: 'Anreichern', description: 'Unternehmen und Leads anreichern' },
        draft: { label: 'Entwurf', description: 'Personalisierte E-Mails generieren' },
        sim: { label: 'Sim', description: 'Demnächst Verfügbar', comingSoon: true },
        send: { label: 'Senden', description: 'Versandmethode wählen' },
      },
      icp: {
        title: 'ICP Auswählen oder Erstellen',
        subtitle: 'Beginnen Sie mit der Definition Ihres idealen Kundenprofils. Sie können aus bestehenden ICPs wählen oder ein neues erstellen.',
        chooseExisting: 'Vorhandenes Auswählen',
        createNew: 'Neu Erstellen',
        companies: 'Unternehmen',
        updated: 'Aktualisiert',
        chatWithAI: 'Mit KI Chatten',
        chatDesc: 'Beschreiben Sie Ihren idealen Kunden und lassen Sie KI helfen',
        quickEntry: 'Schnelleingabe',
        quickDesc: 'Details direkt in einem Formular eingeben',
      },
      hypothesis: {
        title: 'Hypothese Auswählen oder Erstellen',
        subtitle: 'Basierend auf Ihrem ICP:',
        suggested: 'Vorgeschlagene Hypothesen',
        confidence: 'Vertrauen',
        chatDesc: 'Brainstorming zu Targeting-Hypothesen',
        writeHyp: 'Hypothese Schreiben',
        writeDesc: 'Ihre Targeting-Hypothese direkt eingeben',
      },
      segment: {
        title: 'Segmente Auswählen oder Generieren',
        subtitle: 'ICP:',
        hypothesis: 'Hypothese:',
        matching: 'Passende Segmente',
        source: 'Quelle',
        generateNew: 'Neu Generieren',
        searchDB: 'Datenbank Durchsuchen',
        searchDesc: 'Ihre bestehende Unternehmensdatenbank abfragen',
        exaSearch: 'EXA Websuche',
        exaDesc: 'Neue Unternehmen im Web finden',
      },
      enrichment: {
        title: 'Segmentdaten Anreichern',
        subtitle: 'Anreicherung',
        from: 'von:',
        optional: 'Optionaler Schritt',
        optionalDesc: 'Anreicherung verbessert die Personalisierung, aber Sie können diesen Schritt überspringen und direkt zum Entwurf übergehen, wenn nötig.',
        companyData: 'Unternehmensdaten',
        companyDesc: 'Branche, Größe, Finanzierung, Tech-Stack',
        leadDetails: 'Lead-Details',
        leadDesc: 'Kontakte, Rollen, LinkedIn-Profile',
        webIntel: 'Web-Intelligenz',
        webDesc: 'Aktuelle Nachrichten, Einstellungen, Produkteinführungen',
        enrich: 'Anreichern',
        skip: 'Anreicherung Überspringen →',
      },
      locked: {
        title: 'Vorherige Schritte abschließen',
        subtitle: 'Sie müssen die vorherigen Schritte abschließen, bevor Sie auf diesen Abschnitt zugreifen können.',
      },
      aiChat: {
        title: 'KI-Assistent',
        greeting: 'Hallo! Ich bin Ihr KI-Assistent. Ich kann Ihnen helfen, ein neues',
        greeting2: 'basierend auf Ihren Anforderungen zu erstellen. Beschreiben Sie einfach, wonach Sie suchen, und ich werde Sie durch den Prozess führen.',
        placeholder: 'Ihre Nachricht eingeben...',
        send: 'Senden',
      },
      settingsModal: {
        title: 'Einstellungen',
        aiProviders: 'KI-Anbieter',
        taskConfig: 'Aufgabenkonfiguration',
        provider: 'Anbieter',
        model: 'Modell',
        prompt: 'Prompt',
        tasks: {
          icpDiscovery: 'ICP-Entdeckung',
          hypothesisGen: 'Hypothesengenerierung',
          emailDraft: 'E-Mail-Entwurf',
          linkedinMsg: 'LinkedIn-Nachricht',
        },
      },
      servicesModal: {
        title: 'Dienststatus',
        categories: {
          database: 'Datenbank',
          llm: 'LLM',
          delivery: 'Zustellung',
          enrichment: 'Anreicherung',
        },
      },
      inboxPage: {
        title: 'Posteingang',
        subtitle: 'Verwalten Sie Ihre Kampagnenantworten und Konversationen',
        unread: 'Ungelesen',
        all: 'Alle',
        starred: 'Mit Stern',
        noMessages: 'Noch keine Nachrichten',
        noMessagesDesc: 'Wenn Sie Antworten von Ihren Kampagnen erhalten, werden sie hier angezeigt.',
      },
      analyticsPage: {
        title: 'Analytik',
        subtitle: 'Verfolgen Sie die Leistung und Metriken Ihrer Kampagnen',
        overview: 'Übersicht',
        campaigns: 'Kampagnen',
        performance: 'Leistung',
        noData: 'Keine Daten verfügbar',
        noDataDesc: 'Starten Sie Kampagnen, um hier Analysedaten zu sehen.',
      },
      promptRegistryPage: {
        title: 'Prompt-Register',
        subtitle: 'Verwalten und optimieren Sie Ihre KI-Prompts über alle Workflows hinweg',
        allPrompts: 'Alle Prompts',
        active: 'Aktiv',
        pilot: 'Pilot',
        retired: 'Zurückgezogen',
        createNew: 'Prompt Erstellen',
        noPrompts: 'Noch keine Prompts',
        noPromptsDesc: 'Erstellen Sie Ihren ersten Prompt, um Ihre KI-Workflows zu optimieren.',
        step: 'Schritt',
        version: 'Version',
        status: 'Status',
        description: 'Beschreibung',
        promptId: 'Prompt-ID',
        promptText: 'Prompt-Text',
      },
    },
    ru: {
      hero: {
        title1: 'Превращайте лиды в ',
        title2: 'готовые для воронки',
        title3: ' разговоры',
        subtitle: 'Усильте ваш GTM с помощью AI-управляемых процессов. От поиска ICP до управления входящими.',
      },
      title: 'GTM Воронка',
      inbox: 'Входящие',
      analytics: 'Аналитика',
      navPipeline: 'Воронка',
      navInbox: 'Входящие',
      navAnalytics: 'Аналитика',
      collapseNav: 'Свернуть',
      currentConfig: 'Текущая Конфигурация',
      notSelected: 'Не выбрано',
      settings: 'Настройки',
      services: 'Сервисы',
      steps: {
        icp: { label: 'ICP', description: 'Определите идеальный профиль клиента' },
        hypothesis: { label: 'Гипотеза', description: 'Создать гипотезу таргетинга' },
        segment: { label: 'Сегмент', description: 'Выбрать или сгенерировать сегменты' },
        enrichment: { label: 'Обогащение', description: 'Обогатить компании и лиды' },
        draft: { label: 'Черновик', description: 'Создать персонализированные письма' },
        sim: { label: 'Sim', description: 'Скоро Будет', comingSoon: true },
        send: { label: 'Отправка', description: 'Выбрать способ доставки' },
      },
      icp: {
        title: 'Выбрать или Создать ICP',
        subtitle: 'Начните с определения вашего идеального профиля клиента. Вы можете выбрать из существующих ICP или создать новый.',
        chooseExisting: 'Выбрать Существующий',
        createNew: 'Создать Новый',
        companies: 'компаний',
        updated: 'Обновлено',
        chatWithAI: 'Чат с ИИ',
        chatDesc: 'Опишите вашего идеального клиента и позвольте ИИ помочь',
        quickEntry: 'Быстрый Ввод',
        quickDesc: 'Введите детали напрямую в форму',
      },
      hypothesis: {
        title: 'Выбрать или Создать Гипотезу',
        subtitle: 'На основе вашего ICP:',
        suggested: 'Предложенные Гипотезы',
        confidence: 'Уверенность',
        chatDesc: 'Мозговой штурм гипотез таргетинга вместе',
        writeHyp: 'Написать Гипотезу',
        writeDesc: 'Напишите вашу гипотезу таргетинга напрямую',
      },
      segment: {
        title: 'Выбрать или Сгенерировать Сегменты',
        subtitle: 'ICP:',
        hypothesis: 'Гипотеза:',
        matching: 'Подходящие Сегменты',
        source: 'Источник',
        generateNew: 'Сгенерировать Новый',
        searchDB: 'Поиск в Базе Данных',
        searchDesc: 'Запросите вашу существующую базу данных компаний',
        exaSearch: 'Веб-Поиск EXA',
        exaDesc: 'Найдите новые компании в интернете',
      },
      enrichment: {
        title: 'Обогатить Данные Сегмента',
        subtitle: 'Обогащение',
        from: 'из:',
        optional: 'Необязательный Шаг',
        optionalDesc: 'Обогащение улучшает персонализацию, но вы можете пропустить этот шаг и перейти непосредственно к черновику при необходимости.',
        companyData: 'Данные Компании',
        companyDesc: 'Отрасль, размер, финансирование, технологический стек',
        leadDetails: 'Детали Лида',
        leadDesc: 'Контакты, роли, профили LinkedIn',
        webIntel: 'Веб-Разведка',
        webDesc: 'Последние новости, найм, запуски продуктов',
        enrich: 'Обогатить',
        skip: 'Пропустить Обогащение →',
      },
      locked: {
        title: 'Завершите предыдущие шаги',
        subtitle: 'Вам нужно завершить предыдущие шаги перед доступом к этому разделу.',
      },
      aiChat: {
        title: 'ИИ Помощник',
        greeting: 'Привет! Я ваш ИИ-помощник. Я могу помочь вам создать новый',
        greeting2: 'на основе ваших требований. Просто опишите, что вы ищете, и я проведу вас через процесс.',
        placeholder: 'Введите ваше сообщение...',
        send: 'Отправить',
      },
      settingsModal: {
        title: 'Настройки',
        aiProviders: 'Провайдеры ИИ',
        taskConfig: 'Конфигурация Задач',
        provider: 'Провайдер',
        model: 'Модель',
        prompt: 'Промпт',
        tasks: {
          icpDiscovery: 'Поиск ICP',
          hypothesisGen: 'Генерация Гипотез',
          emailDraft: 'Черновик Письма',
          linkedinMsg: 'Сообщение LinkedIn',
        },
      },
      servicesModal: {
        title: 'Статус Сервисов',
        categories: {
          database: 'База Данных',
          llm: 'LLM',
          delivery: 'Доставка',
          enrichment: 'Обогащение',
        },
      },
      inboxPage: {
        title: 'Входящие',
        subtitle: 'Управляйте ответами и разговорами ваших кампаний',
        unread: 'Непрочитанные',
        all: 'Все',
        starred: 'Избранные',
        noMessages: 'Пока нет сообщений',
        noMessagesDesc: 'Когда вы получите ответы от ваших кампаний, они появятся здесь.',
      },
      analyticsPage: {
        title: 'Аналитика',
        subtitle: 'Отслеживайте производительность и метрики ваших кампаний',
        overview: 'Обзор',
        campaigns: 'Кампании',
        performance: 'Производительность',
        noData: 'Нет доступных данных',
        noDataDesc: 'Начните запускать кампании, чтобы увидеть аналитические данные здесь.',
      },
      promptRegistryPage: {
        title: 'Реестр Промптов',
        subtitle: 'Управляйте и оптимизируйте ваши AI промпты во всех процессах',
        allPrompts: 'Все Промпты',
        active: 'Активные',
        pilot: 'Пилот',
        retired: 'Выведенные',
        createNew: 'Создать Промпт',
        noPrompts: 'Пока нет промптов',
        noPromptsDesc: 'Создайте ваш первый промпт для начала оптимизации AI процессов.',
        step: 'Шаг',
        version: 'Версия',
        status: 'Статус',
        description: 'Описание',
        promptId: 'ID Промпта',
        promptText: 'Текст Промпта',
      },
    },
  };

  const t = translations[language];
  const navItems: Array<{
    page: 'pipeline' | 'inbox' | 'analytics' | 'promptRegistry';
    label: string;
    short: string;
    title: string;
  }> = [
    { page: 'pipeline', label: t.navPipeline, short: 'P', title: t.title },
    { page: 'inbox', label: t.navInbox, short: 'I', title: t.inbox },
    { page: 'analytics', label: t.navAnalytics, short: 'A', title: t.analytics },
    { page: 'promptRegistry', label: t.navPromptRegistry, short: 'PR', title: t.promptRegistry },
  ];

  const pipeline = [
    { 
      id: 'icp', 
      label: t.steps.icp.label, 
      number: 1,
      locked: false,
      description: t.steps.icp.description
    },
    { 
      id: 'hypothesis', 
      label: t.steps.hypothesis.label, 
      number: 2,
      locked: !completed.icp,
      description: t.steps.hypothesis.description
    },
    { 
      id: 'segment', 
      label: t.steps.segment.label, 
      number: 3,
      locked: !completed.hypothesis,
      description: t.steps.segment.description
    },
    { 
      id: 'enrichment', 
      label: t.steps.enrichment.label, 
      number: 4,
      locked: !completed.segment,
      description: t.steps.enrichment.description
    },
    { 
      id: 'draft', 
      label: t.steps.draft.label, 
      number: 5,
      locked: !completed.segment,
      description: t.steps.draft.description
    },
    { 
      id: 'sim', 
      label: t.steps.sim.label, 
      number: 6,
      locked: !completed.draft,
      description: t.steps.sim.description,
      comingSoon: true
    },
    { 
      id: 'send', 
      label: t.steps.send.label, 
      number: 7,
      locked: !completed.draft,
      description: t.steps.send.description
    },
  ];

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await fetchServices();
        if (!cancelled) setServices(result.services);
      } catch {
        if (!cancelled) {
          setServices([
            { name: 'Supabase', category: 'database', status: 'disconnected', hasApiKey: false },
            { name: 'Smartlead', category: 'delivery', status: 'disconnected', hasApiKey: false },
          ]);
        }
      }
    };
    load().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadSegments = async () => {
      try {
        const rows = await fetchSegments();
        if (!cancelled) setSegments(rows as any[]);
      } catch {
        if (!cancelled) setSegments([]);
      }
    };
    loadSegments().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadProfiles = async () => {
      try {
        const rows = await fetchIcpProfiles();
        if (!cancelled) {
          setIcpProfiles(rows as any[]);
        }
      } catch {
        if (!cancelled) setIcpProfiles([]);
      }
    };
    loadProfiles().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const icpId = completed.icp?.id;
    if (!icpId) {
      setHypotheses([]);
      return;
    }
    let cancelled = false;
    const loadHypotheses = async () => {
      try {
        const rows = await fetchIcpHypotheses({ icpProfileId: icpId });
        if (!cancelled) setHypotheses(rows as any[]);
      } catch {
        if (!cancelled) setHypotheses([]);
      }
    };
    loadHypotheses().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [completed.icp?.id]);

  useEffect(() => {
    let cancelled = false;
    const loadCampaigns = async () => {
      try {
        const rows = await fetchCampaigns();
        if (cancelled) return;
        setCampaigns(rows as any[]);
        if (!selectedCampaignId && (rows as any[])[0]) {
          setSelectedCampaignId((rows as any[])[0].id as string);
        }
      } catch {
        if (!cancelled) setCampaigns([]);
      }
    };
    loadCampaigns().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [selectedCampaignId]);

  useEffect(() => {
    if (!smartleadReady) return;
    let cancelled = false;
    const loadSmartlead = async () => {
      try {
        const rows = await fetchSmartleadCampaigns();
        if (cancelled) return;
        setSmartleadCampaigns(rows as any[]);
        if (!selectedSmartleadCampaignId && (rows as any[])[0]) {
          setSelectedSmartleadCampaignId((rows as any[])[0].id as string);
        }
      } catch {
        if (!cancelled) setSmartleadCampaigns([]);
      }
    };
    loadSmartlead().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [selectedSmartleadCampaignId, smartleadReady]);

  useEffect(() => {
    if (currentPage !== 'promptRegistry') return;
    let cancelled = false;
    const loadPrompts = async () => {
      setPromptLoading(true);
      setPromptError(null);
      try {
        const rows = await fetchPromptRegistry();
        if (!cancelled) setPromptEntries(rows as any[]);
      } catch (err: any) {
        if (!cancelled) setPromptError(err?.message ?? 'Failed to load prompts');
      } finally {
        if (!cancelled) setPromptLoading(false);
      }
    };
    loadPrompts().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [currentPage]);

  useEffect(() => {
    if (currentPage !== 'inbox') return;
    let cancelled = false;
    const loadInbox = async () => {
      setInboxLoading(true);
      setInboxError(null);
      try {
        const status =
          inboxFilter === 'unread' ? 'unread' : inboxFilter === 'starred' ? 'starred' : undefined;
        const res = await fetchInboxMessages({ status, limit: 50 });
        if (!cancelled) {
          setInboxMessages(res.messages as any[]);
        }
      } catch (err: any) {
        if (!cancelled) {
          setInboxError(err?.message ?? 'Failed to load inbox');
          setInboxMessages([]);
        }
      } finally {
        if (!cancelled) setInboxLoading(false);
      }
    };
    loadInbox().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [currentPage, inboxFilter]);

  useEffect(() => {
    if (currentPage !== 'analytics') return;
    let cancelled = false;
    const loadAnalytics = async () => {
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      try {
        const [summary, optimize] = await Promise.all([
          fetchAnalyticsSummary({ groupBy: analyticsGroupBy, since: undefined }),
          fetchAnalyticsOptimize({ since: undefined }),
        ]);
        if (cancelled) return;
        setAnalyticsRows(summary as any[]);
        setAnalyticsSuggestions(((optimize as any)?.suggestions ?? []) as any[]);
      } catch (err: any) {
        if (cancelled) return;
        setAnalyticsError(err?.message ?? 'Failed to load analytics');
        setAnalyticsRows([]);
        setAnalyticsSuggestions([]);
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    };
    loadAnalytics().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [currentPage, analyticsGroupBy]);

  useEffect(() => {
    setAiTranscript([]);
    setAiMessage('');
    setAiError(null);
  }, [currentStep]);

  const languages = [
    { code: 'en', label: 'EN', name: 'English' },
    { code: 'es', label: 'ES', name: 'Español' },
    { code: 'fr', label: 'FR', name: 'Français' },
    { code: 'de', label: 'DE', name: 'Deutsch' },
    { code: 'ru', label: 'RU', name: 'Русский' },
  ];

  const colors = isDark
    ? {
        bg: '#0A0A0A',
        card: '#161616',
        cardHover: '#1E1E1E',
        text: '#FAFAFA',
        textMuted: '#A0A0A0',
        border: '#2A2A2A',
        orange: '#FF8A5B',
        orangeLight: '#2A1810',
        sidebar: '#0D0D0D',
        navSidebar: '#080808',
        pattern: '#1A1A1A',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      }
    : {
        bg: '#FAFAFA',
        card: '#FFFFFF',
        cardHover: '#FEFEFE',
        text: '#1A1A1A',
        textMuted: '#6B6B6B',
        border: '#E5E5E5',
        orange: '#FF6B35',
        orangeLight: '#FFF4F0',
        sidebar: '#F5F5F5',
        navSidebar: '#F0F0F0',
        pattern: '#E8E8E8',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      };

  const icpSummary = completed.icp ? buildIcpSummaryFromProfile(completed.icp) : null;
  const hypothesisSummary = completed.hypothesis
    ? buildHypothesisSummaryFromSearchConfig(completed.hypothesis)
    : null;

  const handleSelectExisting = (type, item) => {
    setCompleted(prev => ({
      ...prev,
      [type]: item
    }));
    const currentIndex = pipeline.findIndex(s => s.id === type);
    if (currentIndex < pipeline.length - 1) {
      const nextStep = pipeline[currentIndex + 1];
      if (!nextStep.locked || type === currentStep) {
        setCurrentStep(nextStep.id);
      }
    }
  };

  const handleAiSend = async () => {
    const trimmed = aiMessage.trim();
    if (!trimmed) {
      setAiError('Please describe what you want to generate.');
      return;
    }
    setAiTranscript((prev) =>
      appendInteractiveCoachMessage(prev, {
        role: 'user',
        text: trimmed,
        step: currentStep,
        entityId:
          currentStep === 'icp'
            ? completed.icp?.id ?? null
            : currentStep === 'hypothesis'
            ? completed.hypothesis?.id ?? null
            : null,
      })
    );
    setAiLoading(true);
    setAiError(null);
    try {
      if (currentStep === 'icp') {
        const runMode = resolveCoachRunMode('icp', completed as any);
        const promptId = taskPrompts.icpDiscovery || undefined;
        const latestSettings = loadSettings();
        const modelCfg = latestSettings.providers.icp;
        const currentSummary = completed.icp ? buildIcpSummaryFromProfile(completed.icp) : null;
        const summaryForPrompt = runMode === 'refine' ? currentSummary : null;
        const userPrompt = buildInteractiveIcpPrompt(summaryForPrompt, trimmed);
        const profile = await generateIcpProfileViaCoach({
          name: trimmed,
          userPrompt,
          promptId,
          provider: modelCfg.provider,
          model: modelCfg.model,
        });
        setIcpProfiles((prev) => {
          const next = applyCoachResultToState(
            runMode,
            'icp',
            profile,
            prev,
            hypotheses,
            completed as any
          );
          return next.profiles;
        });
        handleSelectExisting('icp', profile);
        const summary = buildIcpSummaryFromProfile(profile);
        const summaryText = formatIcpSummaryForChat(summary);
        if (summaryText) {
          setAiTranscript((prev) =>
            appendInteractiveCoachMessage(prev, {
              role: 'assistant',
              text: summaryText,
              step: 'icp',
              entityId: profile.id,
            })
          );
        }
      } else if (currentStep === 'hypothesis') {
        if (!completed.icp?.id) {
          setAiError('Select an ICP profile first.');
          return;
        }
        const runMode = resolveCoachRunMode('hypothesis', completed as any);
        const promptId = taskPrompts.hypothesisGen || undefined;
        const latestSettings = loadSettings();
        const modelCfg = latestSettings.providers.hypothesis;
        const currentSummary = completed.hypothesis
          ? buildHypothesisSummaryFromSearchConfig(completed.hypothesis)
          : null;
        const summaryForPrompt = runMode === 'refine' ? currentSummary : null;
        const userPrompt = buildInteractiveHypothesisPrompt(summaryForPrompt, trimmed);
        const hyp = await generateHypothesisViaCoach({
          icpProfileId: completed.icp.id,
          hypothesisLabel: trimmed,
          userPrompt,
          provider: modelCfg.provider,
          model: modelCfg.model,
          promptId,
        });
        setHypotheses((prev) => {
          const next = applyCoachResultToState(
            runMode,
            'hypothesis',
            hyp,
            icpProfiles,
            prev,
            completed as any
          );
          return next.hypotheses;
        });
        handleSelectExisting('hypothesis', hyp);
        const summary = buildHypothesisSummaryFromSearchConfig(hyp);
        const summaryText = formatHypothesisSummaryForChat(summary);
        if (summaryText) {
          setAiTranscript((prev) =>
            appendInteractiveCoachMessage(prev, {
              role: 'assistant',
              text: summaryText,
              step: 'hypothesis',
              entityId: hyp.id,
            })
          );
        }
      }
      setAiMessage('');
    } catch (err: any) {
      setAiError(err?.message ?? 'Failed to generate via AI coach');
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreateIcpQuick = async () => {
    const name = newIcpName.trim();
    if (!name) {
      setAiError('ICP name is required.');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const created = await createIcpProfile({
        name,
        description: newIcpDescription.trim() || undefined,
      });
      setIcpProfiles((prev) => [created as any, ...prev]);
      handleSelectExisting('icp', created);
      setNewIcpName('');
      setNewIcpDescription('');
    } catch (err: any) {
      setAiError(err?.message ?? 'Failed to create ICP profile');
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreateHypothesisQuick = async () => {
    const label = newHypothesisLabel.trim();
    if (!completed.icp?.id) {
      setAiError('Select an ICP profile first.');
      return;
    }
    if (!label) {
      setAiError('Hypothesis label is required.');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const created = await createIcpHypothesis({
        icpProfileId: completed.icp.id,
        hypothesisLabel: label,
      });
      setHypotheses((prev) => [created as any, ...prev]);
      handleSelectExisting('hypothesis', created);
      setNewHypothesisLabel('');
    } catch (err: any) {
      setAiError(err?.message ?? 'Failed to create hypothesis');
    } finally {
      setAiLoading(false);
    }
  };

  const handleRunDiscovery = async () => {
    if (!completed.icp?.id) {
      setAiError('Select an ICP profile before running discovery.');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    setDiscoveryStatus(null);
    try {
      const result = await triggerIcpDiscovery({
        icpProfileId: completed.icp.id,
        icpHypothesisId: completed.hypothesis?.id,
      });
      persistLatestDiscoveryRun({
        runId: result.runId,
        icpProfileId: completed.icp.id,
        icpHypothesisId: completed.hypothesis?.id ?? null,
      });
      setDiscoveryStatus(
        `Discovery run ${result.runId} started (${result.provider}). Status: ${result.status}`
      );
    } catch (err: any) {
      setAiError(err?.message ?? 'Failed to start ICP discovery');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSearchDatabaseClick = () => {
    setShowSegmentBuilder(true);
  };

  const handleCreateSegment = async (segment: {name: string; filterDefinition: any[]}) => {
    try {
      // Call API to create segment
      await createSegmentAPI({
        name: segment.name,
        locale: 'en',
        filterDefinition: segment.filterDefinition,
      });

      // Close modal
      setShowSegmentBuilder(false);

      // Refresh segments list
      const updatedSegments = await fetchSegments();
      setSegments(updatedSegments);

      // Optional: Show success message
      console.log('Segment created successfully:', segment.name);
    } catch (error) {
      console.error('Failed to create segment:', error);
      // You could add error state/toast here if needed
    }
  };

  const handleSaveExaSegment = async (segment: {
    name: string;
    companies: any[];
    employees: any[];
    query: string;
  }) => {
    try {
      // Call API to save EXA segment
      await saveExaSegmentAPI({
        name: segment.name,
        locale: language,
        companies: segment.companies,
        employees: segment.employees,
        query: segment.query,
        description: `EXA Web Search: ${segment.query}`,
      });

      // Close modal
      setShowExaWebsetSearch(false);

      // Refresh segments list
      const updatedSegments = await fetchSegments();
      setSegments(updatedSegments);

      // Optional: Show success message
      console.log('EXA segment saved successfully:', segment.name);
    } catch (error) {
      console.error('Failed to save EXA segment:', error);
      // You could add error state/toast here if needed
    }
  };

  const handleEnrichSegment = async () => {
    if (!completed.segment?.id) {
      setAiError('Select a segment before enrichment.');
      return;
    }
    setEnrichLoading(true);
    setAiError(null);
    try {
      const res = (await enqueueSegmentEnrichment({
        segmentId: completed.segment.id,
        adapter: 'mock',
        runNow: true,
      })) as any;
      const status = res?.status ?? res?.summary?.status ?? 'queued';
      setEnrichStatus(status);
      const latest = await fetchEnrichmentStatus(completed.segment.id);
      const latestStatus = (latest as any)?.status ?? status;
      setEnrichStatus(latestStatus);
    } catch (err: any) {
      setAiError(mapEnrichmentErrorMessage(err));
    } finally {
      setEnrichLoading(false);
    }
  };

  const handleGenerateDrafts = async () => {
    if (!selectedCampaignId) {
      setAiError('Select a campaign before generating drafts.');
      return;
    }
    setDraftLoading(true);
    setAiError(null);
    try {
      const settings = loadSettings();
      const draftModel = settings.providers.draft;
      const explicitPromptId = taskPrompts.emailDraft || undefined;
      const res = await triggerDraftGenerate(selectedCampaignId, {
        dryRun: true,
        limit: draftLimit,
        dataQualityMode,
        interactionMode,
        icpProfileId: completed.icp?.id ?? undefined,
        icpHypothesisId: completed.hypothesis?.id ?? undefined,
        provider: draftModel.provider,
        model: draftModel.model,
        explicitCoachPromptId: explicitPromptId,
      });
      setDraftSummary(
        formatDraftSummary({
          generated: res.generated,
          dryRun: res.dryRun,
          dataQualityMode,
          interactionMode,
        })
      );
      setCompleted((prev) => ({
        ...prev,
        draft: { ...res, campaignId: selectedCampaignId },
      }));
      setCurrentStep('send');
    } catch (err: any) {
      setAiError(err?.message ?? 'Failed to generate drafts');
    } finally {
      setDraftLoading(false);
    }
  };

  const handleSendPreview = async () => {
    if (!smartleadReady) {
      setAiError('Smartlead environment is not configured.');
      return;
    }
    if (!selectedSmartleadCampaignId) {
      setAiError('Select a Smartlead campaign before previewing send.');
      return;
    }
    setSendLoading(true);
    setAiError(null);
    try {
      const res = await triggerSmartleadPreview({
        dryRun: true,
        batchSize: 10,
      });
      setSendSummary(
        formatSendSummary(
          {
            fetched: (res as any)?.fetched,
            sent: (res as any)?.sent,
            skipped: (res as any)?.skipped,
          },
          0
        )
      );
    } catch (err: any) {
      setAiError(err?.message ?? 'Failed to preview Smartlead send');
    } finally {
      setSendLoading(false);
    }
  };

  // Get page title based on current page
  const renderStepContent = () => {
    switch (currentStep) {
      case 'icp':
        return (
          <div>
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>{t.icp.title}</h2>
              <p style={{ fontSize: '14px', color: colors.textMuted, lineHeight: '1.6' }}>{t.icp.subtitle}</p>
            </div>

            <div style={{ display: 'grid', gap: '24px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>{t.icp.chooseExisting}</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {icpProfiles.map((profile) => {
                    const companies = (profile as any).company_count ?? 0;
                    const updatedRaw =
                      (profile as any).updated_at ??
                      (profile as any).created_at ??
                      '';
                    const updated =
                      typeof updatedRaw === 'string' && updatedRaw
                        ? updatedRaw
                        : '';
                    const isSelected = completed.icp?.id === profile.id;
                    return (
                    <button
                      key={profile.id}
                      onClick={() => handleSelectExisting('icp', profile)}
                      style={{
                        background: colors.card,
                        border: `1px solid ${isSelected ? colors.orange : colors.border}`,
                        borderRadius: '8px',
                        padding: '16px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = colors.orange;
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = colors.border;
                        }
                      }}
                    >
                      <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>
                        {profile.name ?? profile.id}
                      </div>
                      <div style={{ fontSize: '13px', color: colors.textMuted }}>
                        {companies.toLocaleString()} {t.icp.companies}
                        {updated && ` • ${t.icp.updated}: ${updated}`}
                      </div>
                    </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>{t.icp.createNew}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button
                    onClick={() => setShowAIChat(true)}
                    style={{
                      background: colors.card,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      padding: '20px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.orange; e.currentTarget.style.backgroundColor = colors.cardHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.backgroundColor = colors.card; }}
                  >
                    <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>{t.icp.chatWithAI}</div>
                    <div style={{ fontSize: '13px', color: colors.textMuted, lineHeight: '1.5' }}>{t.icp.chatDesc}</div>
                  </button>

                  <button
                    style={{
                      background: colors.card,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      padding: '20px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.orange; e.currentTarget.style.backgroundColor = colors.cardHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.backgroundColor = colors.card; }}
                  >
                    <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>{t.icp.quickEntry}</div>
                    <div style={{ fontSize: '13px', color: colors.textMuted, lineHeight: '1.5' }}>{t.icp.quickDesc}</div>
                  </button>
                </div>
                <div style={{ marginTop: '12px', display: 'grid', gap: '8px' }}>
                  <input
                    placeholder="ICP name"
                    value={newIcpName}
                    onChange={(e) => setNewIcpName(e.target.value)}
                    style={{
                      background: colors.card,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      padding: '10px 12px',
                      fontSize: '14px',
                    }}
                  />
                  <textarea
                    placeholder="Optional description"
                    value={newIcpDescription}
                    onChange={(e) => setNewIcpDescription(e.target.value)}
                    rows={2}
                    style={{
                      background: colors.card,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      padding: '10px 12px',
                      fontSize: '14px',
                    }}
                  />
                  <button
                    onClick={() => handleCreateIcpQuick().catch(() => null)}
                    disabled={aiLoading}
                    style={{
                      background: colors.orange,
                      color: '#FFF',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: aiLoading ? 'not-allowed' : 'pointer',
                      opacity: aiLoading ? 0.7 : 1,
                      marginTop: '4px',
                    }}
                  >
                    Save ICP
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'hypothesis':
        if (!completed.icp) {
          return (
            <div style={{ textAlign: 'center', padding: '80px 40px' }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: colors.textMuted, marginBottom: '8px' }}>{t.locked.title}</div>
              <div style={{ fontSize: '14px', color: colors.textMuted }}>{t.locked.subtitle}</div>
            </div>
          );
        }
        return (
          <div>
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>{t.hypothesis.title}</h2>
              <p style={{ fontSize: '14px', color: colors.textMuted, lineHeight: '1.6' }}>
                {t.hypothesis.subtitle} <span style={{ fontWeight: 600, color: colors.orange }}>{completed.icp.name}</span>
              </p>
            </div>

            <div style={{ display: 'grid', gap: '24px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>{t.hypothesis.suggested}</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {hypotheses.map((hyp) => {
                    const label =
                      (hyp as any).hypothesis_label ??
                      (hyp as any).text ??
                      hyp.id;
                    const confidenceLabel =
                      (hyp as any).confidence ??
                      ((hyp as any).status === 'active' ? 'High' : 'Medium');
                    const isSelected = completed.hypothesis?.id === hyp.id;
                    return (
                    <button
                      key={hyp.id}
                      onClick={() => handleSelectExisting('hypothesis', hyp)}
                      style={{
                        background: colors.card,
                        border: `1px solid ${isSelected ? colors.orange : colors.border}`,
                        borderRadius: '8px',
                        padding: '16px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = colors.orange;
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = colors.border;
                        }
                      }}
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
                        {t.hypothesis.confidence}:{' '}
                        <span
                          style={{
                            fontWeight: 600,
                            color:
                              confidenceLabel === 'High'
                                ? colors.success
                                : colors.warning,
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
                  <button
                    onClick={() => setShowAIChat(true)}
                    style={{
                      background: colors.card,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      padding: '20px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.orange; e.currentTarget.style.backgroundColor = colors.cardHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.backgroundColor = colors.card; }}
                  >
                    <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>{t.icp.chatWithAI}</div>
                    <div style={{ fontSize: '13px', color: colors.textMuted, lineHeight: '1.5' }}>{t.hypothesis.chatDesc}</div>
                  </button>

                  <button
                    style={{
                      background: colors.card,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      padding: '20px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.orange; e.currentTarget.style.backgroundColor = colors.cardHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.backgroundColor = colors.card; }}
                  >
                    <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>{t.hypothesis.writeHyp}</div>
                    <div style={{ fontSize: '13px', color: colors.textMuted, lineHeight: '1.5' }}>{t.hypothesis.writeDesc}</div>
                  </button>
                </div>
                <div style={{ marginTop: '12px', display: 'grid', gap: '8px' }}>
                  <input
                    placeholder="Hypothesis label"
                    value={newHypothesisLabel}
                    onChange={(e) => setNewHypothesisLabel(e.target.value)}
                    style={{
                      background: colors.card,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      padding: '10px 12px',
                      fontSize: '14px',
                    }}
                  />
                  <button
                    onClick={() => handleCreateHypothesisQuick().catch(() => null)}
                    disabled={aiLoading}
                    style={{
                      background: colors.orange,
                      color: '#FFF',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: aiLoading ? 'not-allowed' : 'pointer',
                      opacity: aiLoading ? 0.7 : 1,
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

      case 'segment':
        if (!completed.hypothesis) {
          return (
            <div style={{ textAlign: 'center', padding: '80px 40px' }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: colors.textMuted, marginBottom: '8px' }}>{t.locked.title}</div>
              <div style={{ fontSize: '14px', color: colors.textMuted }}>{t.locked.subtitle}</div>
            </div>
          );
        }
        return (
          <div>
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>{t.segment.title}</h2>
              <div style={{ fontSize: '14px', color: colors.textMuted, lineHeight: '1.8' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{t.segment.subtitle}</span>{' '}
                  {completed.icp?.name ?? completed.icp?.id}
                </div>
                <div>
                  <span style={{ fontWeight: 600 }}>{t.segment.hypothesis}</span>{' '}
                  {completed.hypothesis?.hypothesis_label ??
                    completed.hypothesis?.text ??
                    completed.hypothesis?.id}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '24px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>{t.segment.matching}</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {segments.map((seg) => {
                    const isSelected = completed.segment?.id === seg.id;
                    const name = seg.name ?? seg.id;
                    const size = (seg as any).company_count ?? 0;
                    const source =
                      (seg as any).source ??
                      ((seg as any).icp_profile_id || (seg as any).icp_hypothesis_id
                        ? 'ICP'
                        : 'Database');
                    return (
                      <button
                        key={seg.id}
                        onClick={() => handleSelectExisting('segment', seg)}
                        style={{
                          background: colors.card,
                          border: `1px solid ${isSelected ? colors.orange : colors.border}`,
                          borderRadius: '8px',
                          padding: '16px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = colors.orange;
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = colors.border;
                          }
                        }}
                      >
                        <div
                          style={{
                            fontSize: '15px',
                            fontWeight: 600,
                            marginBottom: '8px',
                            color: colors.text,
                          }}
                        >
                          {name}
                        </div>
                        <div style={{ fontSize: '13px', color: colors.textMuted }}>
                          {size.toLocaleString()} {t.icp.companies} • {t.segment.source}: {source}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>{t.segment.generateNew}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button
                    style={{
                      background: colors.card,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      padding: '20px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onClick={handleSearchDatabaseClick}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.orange; e.currentTarget.style.backgroundColor = colors.cardHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.backgroundColor = colors.card; }}
                  >
                    <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>{t.segment.searchDB}</div>
                    <div style={{ fontSize: '13px', color: colors.textMuted, lineHeight: '1.5' }}>{t.segment.searchDesc}</div>
                  </button>

                  <button
                    onClick={() => setShowExaWebsetSearch(true)}
                    style={{
                      background: colors.card,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      padding: '20px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.orange; e.currentTarget.style.backgroundColor = colors.cardHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.backgroundColor = colors.card; }}
                  >
                    <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>{t.segment.exaSearch}</div>
                    <div style={{ fontSize: '13px', color: colors.textMuted, lineHeight: '1.5' }}>{t.segment.exaDesc}</div>
                  </button>
                </div>
                {(discoveryStatus || hasPersistedDiscoveryRun()) && (
                  <div
                    style={{
                      marginTop: '8px',
                      fontSize: '12px',
                      color: colors.textMuted,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    {discoveryStatus && <div>{discoveryStatus}</div>}
                    {hasPersistedDiscoveryRun() && (
                      <button
                        type="button"
                        onClick={openIcpDiscoveryForLatestRun}
                        style={{
                          alignSelf: 'flex-start',
                          padding: '4px 10px',
                          fontSize: '12px',
                          borderRadius: '999px',
                          border: `1px solid ${colors.orange}`,
                          backgroundColor: colors.orangeLight,
                          color: colors.orange,
                          cursor: 'pointer',
                        }}
                      >
                        Review candidates in ICP Discovery
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'enrichment':
        if (!completed.segment) {
          return (
            <div style={{ textAlign: 'center', padding: '80px 40px' }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: colors.textMuted, marginBottom: '8px' }}>{t.locked.title}</div>
              <div style={{ fontSize: '14px', color: colors.textMuted }}>{t.locked.subtitle}</div>
            </div>
          );
        }
        return (
          <div>
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>{t.enrichment.title}</h2>
              <div style={{ fontSize: '14px', color: colors.textMuted, lineHeight: '1.8' }}>
                <div><span style={{ fontWeight: 600 }}>{t.enrichment.subtitle}:</span> {completed.segment.name}</div>
                <div><span style={{ fontWeight: 600 }}>{t.enrichment.from}</span> {completed.segment.source}</div>
              </div>
            </div>

            <div style={{ background: colors.orangeLight, border: `1px solid ${colors.orange}`, borderRadius: '12px', padding: '20px', marginBottom: '32px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: colors.orange, marginBottom: '8px' }}>{t.enrichment.optional}</div>
              <div style={{ fontSize: '13px', color: colors.text, lineHeight: '1.6' }}>{t.enrichment.optionalDesc}</div>
            </div>

            <div style={{ display: 'grid', gap: '16px', marginBottom: '32px' }}>
              <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '20px' }}>
                <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>{t.enrichment.companyData}</div>
                <div style={{ fontSize: '13px', color: colors.textMuted, lineHeight: '1.5' }}>{t.enrichment.companyDesc}</div>
              </div>

              <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '20px' }}>
                <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>{t.enrichment.leadDetails}</div>
                <div style={{ fontSize: '13px', color: colors.textMuted, lineHeight: '1.5' }}>{t.enrichment.leadDesc}</div>
              </div>

              <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '20px' }}>
                <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>{t.enrichment.webIntel}</div>
                <div style={{ fontSize: '13px', color: colors.textMuted, lineHeight: '1.5' }}>{t.enrichment.webDesc}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => handleEnrichSegment().catch(() => null)}
                style={{
                  background: colors.orange,
                  color: '#FFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '14px 32px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: enrichLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
                disabled={enrichLoading}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                {enrichLoading ? 'Enriching…' : t.enrichment.enrich}
              </button>

              <button
                onClick={() => setCurrentStep('draft')}
                style={{
                  background: 'transparent',
                  color: colors.textMuted,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  padding: '14px 32px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.orange; e.currentTarget.style.color = colors.orange; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.color = colors.textMuted; }}
              >
                {t.enrichment.skip}
              </button>
            </div>

            {enrichStatus && (
              <div
                style={{
                  marginTop: '12px',
                  fontSize: '12px',
                  color: colors.textMuted,
                }}
              >
                Enrichment status: {enrichStatus}
              </div>
            )}
          </div>
        );

      case 'draft':
        if (!completed.segment) {
          return (
            <div style={{ textAlign: 'center', padding: '80px 40px' }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: colors.textMuted, marginBottom: '8px' }}>{t.locked.title}</div>
              <div style={{ fontSize: '14px', color: colors.textMuted }}>{t.locked.subtitle}</div>
            </div>
          );
        }
        return (
          <div>
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>{t.steps.draft.label}</h2>
              <div style={{ fontSize: '14px', color: colors.textMuted, lineHeight: '1.8' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{t.segment.subtitle}</span>{' '}
                  {completed.icp?.name ?? completed.icp?.id}
                </div>
                <div>
                  <span style={{ fontWeight: 600 }}>{t.segment.hypothesis}</span>{' '}
                  {completed.hypothesis?.hypothesis_label ??
                    completed.hypothesis?.text ??
                    completed.hypothesis?.id}
                </div>
                <div>
                  <span style={{ fontWeight: 600 }}>{t.steps.segment.label}:</span>{' '}
                  {completed.segment?.name ?? completed.segment?.id}
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
                  Campaign & generation settings
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
                      Campaign
                    </div>
                    <select
                      value={selectedCampaignId}
                      onChange={(e) => setSelectedCampaignId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: `1px solid ${colors.border}`,
                        background: colors.card,
                        fontSize: '14px',
                      }}
                    >
                      <option value="">Select campaign</option>
                      {campaigns.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.name ?? c.id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: colors.textMuted,
                          marginBottom: '4px',
                        }}
                      >
                        Draft limit
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={draftLimit}
                        onChange={(e) => setDraftLimit(Number(e.target.value) || 0)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: `1px solid ${colors.border}`,
                          background: colors.card,
                          fontSize: '14px',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: colors.textMuted,
                          marginBottom: '8px',
                        }}
                      >
                        Data quality
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setDataQualityMode('strict')}
                          style={{
                            flex: 1,
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: `1px solid ${
                              dataQualityMode === 'strict' ? colors.orange : colors.border
                            }`,
                            background:
                              dataQualityMode === 'strict' ? colors.orangeLight : colors.card,
                            color:
                              dataQualityMode === 'strict' ? colors.orange : colors.textMuted,
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Strict
                        </button>
                        <button
                          type="button"
                          onClick={() => setDataQualityMode('graceful')}
                          style={{
                            flex: 1,
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: `1px solid ${
                              dataQualityMode === 'graceful' ? colors.orange : colors.border
                            }`,
                            background:
                              dataQualityMode === 'graceful'
                                ? colors.orangeLight
                                : colors.card,
                            color:
                              dataQualityMode === 'graceful' ? colors.orange : colors.textMuted,
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Graceful
                        </button>
                      </div>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: colors.textMuted,
                          marginBottom: '8px',
                        }}
                      >
                        Interaction mode
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setInteractionMode('express')}
                          style={{
                            flex: 1,
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: `1px solid ${
                              interactionMode === 'express' ? colors.orange : colors.border
                            }`,
                            background:
                              interactionMode === 'express' ? colors.orangeLight : colors.card,
                            color:
                              interactionMode === 'express' ? colors.orange : colors.textMuted,
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Express
                        </button>
                        <button
                          type="button"
                          onClick={() => setInteractionMode('coach')}
                          style={{
                            flex: 1,
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: `1px solid ${
                              interactionMode === 'coach' ? colors.orange : colors.border
                            }`,
                            background:
                              interactionMode === 'coach' ? colors.orangeLight : colors.card,
                            color:
                              interactionMode === 'coach' ? colors.orange : colors.textMuted,
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Coach
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <button
                      onClick={() => handleGenerateDrafts().catch(() => null)}
                      disabled={draftLoading || !selectedCampaignId}
                      style={{
                        background: colors.orange,
                        color: '#FFF',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '12px 24px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor:
                          draftLoading || !selectedCampaignId ? 'not-allowed' : 'pointer',
                        opacity: draftLoading || !selectedCampaignId ? 0.7 : 1,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {draftLoading ? 'Generating…' : 'Generate drafts'}
                    </button>
                  </div>

                  {draftSummary && (
                    <div
                      style={{
                        marginTop: '10px',
                        fontSize: '12px',
                        color: colors.textMuted,
                      }}
                    >
                      {draftSummary}
                    </div>
                  )}
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
                    Draft summary
                  </div>
                  <div style={{ fontSize: '12px', color: colors.textMuted, lineHeight: '1.6' }}>
                    Use this step to generate email drafts bound to the selected campaign and
                    segment. You can keep data quality strict for early pilots and switch to
                    graceful once enrichment stabilizes.
                  </div>
                  {draftSummary && (
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
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 'send':
        if (!completed.draft) {
          return (
            <div style={{ textAlign: 'center', padding: '80px 40px' }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: colors.textMuted, marginBottom: '8px' }}>{t.locked.title}</div>
              <div style={{ fontSize: '14px', color: colors.textMuted }}>{t.locked.subtitle}</div>
            </div>
          );
        }
        return (
          <div>
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>{t.steps.send.label}</h2>
              <div style={{ fontSize: '14px', color: colors.textMuted, lineHeight: '1.8' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>Delivery provider:</span>{' '}
                  {smartleadReady ? 'Smartlead (ready)' : 'Smartlead (not configured)'}
                </div>
                <div>
                  <span style={{ fontWeight: 600 }}>Campaign:</span>{' '}
                  {selectedCampaignId
                    ? campaigns.find((c: any) => c.id === selectedCampaignId)?.name ??
                      selectedCampaignId
                    : t.notSelected}
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
                  Smartlead preview
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
                      onChange={(e) => setSelectedSmartleadCampaignId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: `1px solid ${colors.border}`,
                        background: colors.card,
                        fontSize: '14px',
                      }}
                    >
                      <option value="">Select Smartlead campaign</option>
                      {smartleadCampaigns.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.name ?? c.id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <button
                      onClick={() => handleSendPreview().catch(() => null)}
                      disabled={sendLoading || !smartleadReady || !selectedSmartleadCampaignId}
                      style={{
                        background: colors.orange,
                        color: '#FFF',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '12px 24px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor:
                          sendLoading || !smartleadReady || !selectedSmartleadCampaignId
                            ? 'not-allowed'
                            : 'pointer',
                        opacity:
                          sendLoading || !smartleadReady || !selectedSmartleadCampaignId
                            ? 0.7
                            : 1,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {sendLoading ? 'Previewing…' : 'Preview in Smartlead'}
                    </button>
                  </div>

                  {sendSummary && (
                    <div
                      style={{
                        marginTop: '10px',
                        fontSize: '12px',
                        color: colors.textMuted,
                      }}
                    >
                      {sendSummary}
                    </div>
                  )}
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
                    This workspace uses a preview-only send path. Smartlead receive a capped batch
                    for inspection, and no live send is triggered from the UI yet. Use the CLI or
                    Smartlead dashboard when you are ready for full production sends.
                  </div>
                  {sendSummary && (
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
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div style={{ textAlign: 'center', padding: '80px 40px' }}>
            <div style={{ fontSize: '18px', fontWeight: 600, color: colors.textMuted, marginBottom: '8px' }}>{t.locked.title}</div>
            <div style={{ fontSize: '14px', color: colors.textMuted }}>{t.locked.subtitle}</div>
          </div>
        );
    }
  };

  // Render main content based on current page
  const renderPageContent = () => {
    if (currentPage === 'inbox') {
      return (
        <div style={{ padding: '40px', maxWidth: '1200px' }}>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>{t.inboxPage.title}</h1>
            <p style={{ fontSize: '14px', color: colors.textMuted }}>{t.inboxPage.subtitle}</p>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <button
              style={{
                background: inboxFilter === 'unread' ? colors.orangeLight : colors.card,
                border: `2px solid ${
                  inboxFilter === 'unread' ? colors.orange : colors.border
                }`,
                color: inboxFilter === 'unread' ? colors.orange : colors.text,
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => setInboxFilter('unread')}
            >
              {t.inboxPage.unread}
            </button>
            <button
              style={{
                background: inboxFilter === 'all' ? colors.orangeLight : colors.card,
                border: `1px solid ${
                  inboxFilter === 'all' ? colors.orange : colors.border
                }`,
                color: inboxFilter === 'all' ? colors.orange : colors.text,
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              onClick={() => setInboxFilter('all')}
            >
              {t.inboxPage.all}
            </button>
            <button
              style={{
                background: inboxFilter === 'starred' ? colors.orangeLight : colors.card,
                border: `1px solid ${
                  inboxFilter === 'starred' ? colors.orange : colors.border
                }`,
                color: inboxFilter === 'starred' ? colors.orange : colors.text,
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              onClick={() => setInboxFilter('starred')}
            >
              {t.inboxPage.starred}
            </button>
          </div>

          <div
            style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              padding: '24px 24px 20px',
            }}
          >
            {inboxLoading && (
              <div style={{ fontSize: '14px', color: colors.textMuted, textAlign: 'center' }}>
                Loading inbox…
              </div>
            )}
            {!inboxLoading && inboxError && (
              <div style={{ fontSize: '14px', color: colors.error, textAlign: 'center' }}>
                {inboxError}
              </div>
            )}
            {!inboxLoading && !inboxError && inboxMessages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: colors.textMuted,
                    marginBottom: '8px',
                  }}
                >
                  {t.inboxPage.noMessages}
                </div>
                <div style={{ fontSize: '14px', color: colors.textMuted }}>
                  {t.inboxPage.noMessagesDesc}
                </div>
              </div>
            )}
            {!inboxLoading && !inboxError && inboxMessages.length > 0 && (
              <div style={{ display: 'grid', gap: '8px' }}>
                {inboxMessages.map((msg: any) => (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: colors.sidebar,
                    }}
                  >
                    <div style={{ maxWidth: '70%', overflow: 'hidden' }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: msg.read ? 500 : 700,
                          color: colors.text,
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                        }}
                      >
                        {msg.subject ?? '(no subject)'}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: colors.textMuted,
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                        }}
                      >
                        {msg.category ?? 'unlabeled'} · {msg.receivedAt ?? ''}
                      </div>
                    </div>
                    {!msg.read && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: colors.orange,
                          background: colors.orangeLight,
                          padding: '3px 8px',
                          borderRadius: '999px',
                        }}
                      >
                        New
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (currentPage === 'analytics') {
      return (
        <div style={{ padding: '40px', maxWidth: '1200px' }}>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>{t.analyticsPage.title}</h1>
            <p style={{ fontSize: '14px', color: colors.textMuted }}>{t.analyticsPage.subtitle}</p>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <button
              style={{
                background: analyticsGroupBy === 'icp' ? colors.orangeLight : colors.card,
                border: `2px solid ${analyticsGroupBy === 'icp' ? colors.orange : colors.border}`,
                color: analyticsGroupBy === 'icp' ? colors.orange : colors.text,
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => setAnalyticsGroupBy('icp')}
            >
              {t.analyticsPage.overview}
            </button>
            <button
              style={{
                background: analyticsGroupBy === 'segment' ? colors.orangeLight : colors.card,
                border: `1px solid ${analyticsGroupBy === 'segment' ? colors.orange : colors.border}`,
                color: analyticsGroupBy === 'segment' ? colors.orange : colors.text,
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              onClick={() => setAnalyticsGroupBy('segment')}
            >
              {t.analyticsPage.campaigns}
            </button>
            <button
              style={{
                background: analyticsGroupBy === 'pattern' ? colors.orangeLight : colors.card,
                border: `1px solid ${analyticsGroupBy === 'pattern' ? colors.orange : colors.border}`,
                color: analyticsGroupBy === 'pattern' ? colors.orange : colors.text,
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              onClick={() => setAnalyticsGroupBy('pattern')}
            >
              {t.analyticsPage.performance}
            </button>
          </div>

          <div
            style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              padding: '24px 24px 20px',
            }}
          >
            {analyticsLoading && (
              <div style={{ fontSize: '14px', color: colors.textMuted, textAlign: 'center' }}>
                Loading analytics…
              </div>
            )}
            {!analyticsLoading && analyticsError && (
              <div style={{ fontSize: '14px', color: colors.error, textAlign: 'center' }}>
                {analyticsError}
              </div>
            )}
            {!analyticsLoading && !analyticsError && (
              <>
                {analyticsRows.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                    <div
                      style={{
                        fontSize: '18px',
                        fontWeight: 600,
                        color: colors.textMuted,
                        marginBottom: '8px',
                      }}
                    >
                      {t.analyticsPage.noData}
                    </div>
                    <div style={{ fontSize: '14px', color: colors.textMuted }}>
                      {t.analyticsPage.noDataDesc}
                    </div>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const totals = aggregateAnalyticsMetrics(analyticsRows as any[]);
                      return (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '12px',
                            marginBottom: '16px',
                          }}
                        >
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
                              Delivered
                            </div>
                            <div style={{ fontSize: '18px', fontWeight: 700, color: colors.text }}>
                              {totals.delivered}
                            </div>
                          </div>
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
                              Opened
                            </div>
                            <div style={{ fontSize: '18px', fontWeight: 700, color: colors.text }}>
                              {totals.opened}
                            </div>
                          </div>
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
                              Replied
                            </div>
                            <div style={{ fontSize: '18px', fontWeight: 700, color: colors.text }}>
                              {totals.replied}
                            </div>
                          </div>
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
                              Positive
                            </div>
                            <div style={{ fontSize: '18px', fontWeight: 700, color: colors.text }}>
                              {totals.positive}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

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
                        {analyticsRows.slice(0, 5).map((row: any, idx: number) => (
                          <div
                            key={idx}
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
                              {formatAnalyticsGroupKey(analyticsGroupBy, row)}
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

                    {analyticsSuggestions.length > 0 && (
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
                          {analyticsSuggestions.slice(0, 3).map((s: any, idx: number) => (
                            <li key={idx}>
                              {(s.draft_pattern ?? 'pattern')}{' '}
                              {s.recommendation ? `→ ${s.recommendation}` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      );
    }

    if (currentPage === 'promptRegistry') {
      return (
        <div style={{ padding: '40px', maxWidth: '1200px' }}>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>{t.promptRegistryPage.title}</h1>
            <p style={{ fontSize: '14px', color: colors.textMuted }}>{t.promptRegistryPage.subtitle}</p>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center' }}>
            <button
              style={{ background: promptFilterStatus === 'all' ? colors.orangeLight : colors.card, border: `2px solid ${promptFilterStatus === 'all' ? colors.orange : colors.border}`, color: promptFilterStatus === 'all' ? colors.orange : colors.text, padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              onClick={() => setPromptFilterStatus('all')}
            >
              {t.promptRegistryPage.allPrompts}
            </button>
            <button
              style={{ background: promptFilterStatus === 'active' ? colors.orangeLight : colors.card, border: `1px solid ${promptFilterStatus === 'active' ? colors.orange : colors.border}`, color: promptFilterStatus === 'active' ? colors.orange : colors.text, padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
              onClick={() => setPromptFilterStatus('active')}
            >
              {t.promptRegistryPage.active}
            </button>
            <button
              style={{ background: promptFilterStatus === 'pilot' ? colors.orangeLight : colors.card, border: `1px solid ${promptFilterStatus === 'pilot' ? colors.orange : colors.border}`, color: promptFilterStatus === 'pilot' ? colors.orange : colors.text, padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
              onClick={() => setPromptFilterStatus('pilot')}
            >
              {t.promptRegistryPage.pilot}
            </button>
            <button
              style={{ background: promptFilterStatus === 'retired' ? colors.orangeLight : colors.card, border: `1px solid ${promptFilterStatus === 'retired' ? colors.orange : colors.border}`, color: promptFilterStatus === 'retired' ? colors.orange : colors.text, padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
              onClick={() => setPromptFilterStatus('retired')}
            >
              {t.promptRegistryPage.retired}
            </button>
            <div style={{ flex: 1 }}></div>
            <button
              onClick={() => setShowPromptCreate(!showPromptCreate)}
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
              <span>{t.promptRegistryPage.createNew}</span>
              <span style={{ fontSize: '11px', fontWeight: 600, background: '#fff', color: colors.orange, padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>SOON</span>
            </button>
          </div>

          {showPromptCreate && (
            <div
              style={{
                marginBottom: '24px',
                marginTop: '8px',
                background: colors.card,
                border: `1px solid ${colors.border}`,
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'grid',
                gap: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 600, color: colors.text }}>
                  New prompt entry
                </div>
                <button
                  type="button"
                  onClick={() => setShowPromptCreate(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '12px',
                    color: colors.textMuted,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Cancel
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr',
                  gap: '12px',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: colors.textMuted,
                      marginBottom: '4px',
                    }}
                  >
                    {t.promptRegistryPage.promptId}
                  </div>
                  <input
                    placeholder="icp_profile_v1"
                    value={promptCreateForm.id}
                    onChange={(e) =>
                      setPromptCreateForm((prev) => ({ ...prev, id: e.target.value }))
                    }
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      background: colors.sidebar,
                      color: colors.text,
                      fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: colors.textMuted,
                      marginBottom: '4px',
                    }}
                  >
                    {t.promptRegistryPage.version}
                  </div>
                  <input
                    placeholder="v1"
                    value={promptCreateForm.version}
                    onChange={(e) =>
                      setPromptCreateForm((prev) => ({
                        ...prev,
                        version: e.target.value,
                      }))
                    }
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      background: colors.sidebar,
                      color: colors.text,
                      fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: colors.textMuted,
                      marginBottom: '4px',
                    }}
                  >
                    {t.promptRegistryPage.status}
                  </div>
                  <select
                    value={promptCreateForm.rollout_status}
                    onChange={(e) =>
                      setPromptCreateForm((prev) => ({
                        ...prev,
                        rollout_status: e.target.value,
                      }))
                    }
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      background: colors.sidebar,
                      color: colors.text,
                      fontSize: '13px',
                    }}
                  >
                    <option value="pilot">Pilot</option>
                    <option value="active">Active</option>
                    <option value="retired">Retired</option>
                  </select>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '3fr 1fr',
                  gap: '12px',
                  alignItems: 'flex-end',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: colors.textMuted,
                      marginBottom: '4px',
                    }}
                  >
                    {t.promptRegistryPage.description}
                  </div>
                  <input
                    placeholder="Short description"
                    value={promptCreateForm.description}
                    onChange={(e) =>
                      setPromptCreateForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      background: colors.sidebar,
                      color: colors.text,
                      fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: colors.textMuted,
                      marginBottom: '4px',
                    }}
                  >
                    {t.promptRegistryPage.promptText}
                  </div>
                  <textarea
                    placeholder="Optional variant text; scaffold is fixed"
                    value={promptCreateForm.prompt_text}
                    onChange={(e) =>
                      setPromptCreateForm((prev) => ({
                        ...prev,
                        prompt_text: e.target.value,
                      }))
                    }
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      background: colors.sidebar,
                      color: colors.text,
                      fontSize: '13px',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  type="button"
                  disabled={promptLoading || !promptCreateForm.id.trim()}
                  onClick={async () => {
                    try {
                      setPromptLoading(true);
                      setPromptError(null);
                      const payload = buildPromptCreateEntry(promptCreateForm as any);
                      await createPromptRegistryEntry(payload as any);
                      const rows = await fetchPromptRegistry();
                      setPromptEntries(rows as any[]);
                      setPromptCreateForm((prev) => ({
                        ...prev,
                        description: '',
                        prompt_text: '',
                      }));
                      setShowPromptCreate(false);
                    } catch (err: any) {
                      setPromptError(err?.message ?? 'Failed to create prompt');
                    } finally {
                      setPromptLoading(false);
                    }
                  }}
                  style={{
                    background: colors.orange,
                    color: '#FFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 18px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor:
                      promptLoading || !promptCreateForm.id.trim()
                        ? 'not-allowed'
                        : 'pointer',
                    opacity:
                      promptLoading || !promptCreateForm.id.trim()
                        ? 0.6
                        : 1,
                  }}
                >
                  {promptLoading ? 'Saving…' : 'Save prompt'}
                </button>
              </div>
            </div>
          )}

          {/* Task Configuration */}
          <div
            style={{
              marginBottom: '32px',
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              padding: '24px',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>
              {t.settingsModal.taskConfig}
            </h3>
            <div style={{ display: 'grid', gap: '20px' }}>
              {(['icpDiscovery', 'hypothesisGen', 'emailDraft', 'linkedinMsg'] as TaskKey[]).map(
                (task) => {
                  const options = getPromptOptions(promptEntries as any);
                  const selectDisabled = options.length === 0 || promptLoading;
                  const activeId = getTaskSelectionLabel(taskPrompts, task);
                          const providerKey = mapTaskToProviderKey(task);
                          const providerCfg = settings.providers[providerKey];
                  return (
                    <div key={task}>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          marginBottom: '10px',
                          color: colors.text,
                        }}
                      >
                        {t.settingsModal.tasks[task]}
                      </div>

                      {/* Column Headers */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr',
                          gap: '12px',
                          marginBottom: '6px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: colors.textMuted,
                            paddingLeft: '4px',
                          }}
                        >
                          {t.settingsModal.provider}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: colors.textMuted,
                            paddingLeft: '4px',
                          }}
                        >
                          {t.settingsModal.model}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: colors.textMuted,
                            paddingLeft: '4px',
                          }}
                        >
                          {t.settingsModal.prompt}
                        </div>
                      </div>

                      {/* Selects */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr',
                          gap: '12px',
                        }}
                      >
                        {(() => {
                          const modelOptions = getModelOptionsForProvider(providerCfg.provider, llmModels);
                          const providerError = llmModelsError[providerCfg.provider];
                          const isValidModel = modelOptions.some((opt) => opt.value === providerCfg.model);
                          const effectiveModel = isValidModel
                            ? providerCfg.model
                            : modelOptions[0]?.value ?? '';
                          if (!isValidModel && effectiveModel) {
                            const next: Settings = {
                              ...settings,
                              providers: {
                                ...settings.providers,
                                [providerKey]: {
                                  ...settings.providers[providerKey],
                                  model: effectiveModel,
                                },
                              },
                            };
                            setSettings(next);
                            saveSettings(next);
                          }
                          return (
                            <>
                              <select
                                value={providerCfg.provider}
                                onChange={(e) => {
                                  const nextProvider = e.target.value;
                                  const optionsForNext = getModelOptionsForProvider(nextProvider, llmModels);
                                  const nextModel =
                                    optionsForNext.find((opt) => opt.value === providerCfg.model)?.value ||
                                    optionsForNext[0]?.value ||
                                    '';
                                  const next: Settings = {
                                    ...settings,
                                    providers: {
                                      ...settings.providers,
                                      [providerKey]: {
                                        provider: nextProvider,
                                        model: nextModel,
                                      },
                                    },
                                  };
                                  setSettings(next);
                                  saveSettings(next);
                                }}
                                style={{
                                  background: colors.sidebar,
                                  border: `1px solid ${colors.border}`,
                                  borderRadius: '8px',
                                  padding: '10px 14px',
                                  fontSize: '14px',
                                  color: colors.text,
                                  cursor: 'pointer',
                                }}
                              >
                                <option value="openai">OpenAI</option>
                                <option value="anthropic">Anthropic</option>
                                <option value="gemini">Gemini</option>
                              </select>
                              <select
                                value={effectiveModel}
                                onChange={(e) => {
                                  const next: Settings = {
                                    ...settings,
                                    providers: {
                                      ...settings.providers,
                                      [providerKey]: {
                                        ...settings.providers[providerKey],
                                        model: e.target.value,
                                      },
                                    },
                                  };
                                  setSettings(next);
                                  saveSettings(next);
                                }}
                                style={{
                                  background: colors.sidebar,
                                  border: `1px solid ${colors.border}`,
                                  borderRadius: '8px',
                                  padding: '10px 14px',
                                  fontSize: '14px',
                                  color: colors.text,
                                  cursor: modelOptions.length ? 'pointer' : 'not-allowed',
                                }}
                                disabled={!modelOptions.length}
                              >
                                {modelOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <select
                                disabled={selectDisabled}
                                value={activeId ?? ''}
                                onChange={(e) => {
                                  const coachPromptId = e.target.value || undefined;
                                  setTaskPrompts((prev) => {
                                    const next = setTaskPrompt(
                                      prev,
                                      task,
                                      coachPromptId as string | undefined
                                    );
                                    try {
                                      const currentSettings = loadSettings();
                                      saveSettings({
                                        ...currentSettings,
                                        taskPrompts: next,
                                      });
                                    } catch {
                                      // Swallow persistence errors; UI state still updates.
                                    }
                                    return next;
                                  });
                                }}
                                style={{
                                  background: colors.sidebar,
                                  border: `1px solid ${colors.border}`,
                                  borderRadius: '8px',
                                  padding: '10px 14px',
                                  fontSize: '14px',
                                  color: colors.text,
                                  cursor: selectDisabled ? 'not-allowed' : 'pointer',
                                }}
                              >
                                <option value="">
                                  {options.length ? 'Select prompt...' : 'No prompts available'}
                                </option>
                                {options.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </>
                          );
                        })()}
                      </div>
                      <div
                        style={{
                          marginTop: '6px',
                          fontSize: '12px',
                          color: colors.textMuted,
                        }}
                      >
                        Active prompt: {activeId ?? 'None set'}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* Live LLM Models */}
          <div
            style={{
              marginBottom: '24px',
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              padding: '16px 20px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
              Live LLM models (via provider APIs)
            </h3>
            <div style={{ fontSize: '12px', color: colors.textMuted, marginBottom: '8px' }}>
              Lists are fetched from each provider&apos;s `/models` endpoint using your configured API keys.
            </div>
            {(['openai', 'anthropic'] as const).map((provider) => {
              const models = llmModels[provider] ?? [];
              const err = llmModelsError[provider];
              return (
                <div key={provider} style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    {provider === 'openai' ? 'OpenAI' : 'Anthropic'}
                  </div>
                  {err ? (
                    <div style={{ fontSize: '12px', color: colors.error }}>
                      Failed to list models: {err}
                    </div>
                  ) : models.length ? (
                    <div
                      style={{
                        fontSize: '12px',
                        color: colors.textMuted,
                        maxHeight: '120px',
                        overflow: 'auto',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '8px',
                        padding: '8px 10px',
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {models.join(', ')}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: colors.textMuted }}>Loading…</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Prompt Registry Table */}
            <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ background: colors.sidebar, padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, display: 'grid', gridTemplateColumns: '120px 100px 100px 1fr 180px', gap: '16px', fontSize: '13px', fontWeight: 600, color: colors.textMuted }}>
              <div>{t.promptRegistryPage.promptId}</div>
              <div>{t.promptRegistryPage.step}</div>
              <div>{t.promptRegistryPage.version}</div>
              <div>{t.promptRegistryPage.description}</div>
              <div>{t.promptRegistryPage.status}</div>
            </div>
            {promptLoading && (
              <div style={{ padding: '40px 32px', textAlign: 'center', fontSize: '14px', color: colors.textMuted }}>
                Loading prompts…
              </div>
            )}
            {!promptLoading && promptError && (
              <div style={{ padding: '40px 32px', textAlign: 'center', fontSize: '14px', color: colors.error }}>
                {promptError}
              </div>
            )}
            {!promptLoading && !promptError && (() => {
              const filtered = promptEntries.filter((entry) => {
                const statusKey = getPromptStatusKey(entry);
                if (promptFilterStatus === 'all') return true;
                if (promptFilterStatus === 'active') return statusKey === 'active';
                if (promptFilterStatus === 'pilot') return entry.rollout_status === 'pilot';
                if (promptFilterStatus === 'retired') return entry.rollout_status === 'retired';
                return true;
              });
              if (!filtered.length) {
                return (
                  <div style={{ padding: '80px 40px', textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: colors.textMuted, marginBottom: '8px' }}>{t.promptRegistryPage.noPrompts}</div>
                    <div style={{ fontSize: '14px', color: colors.textMuted }}>{t.promptRegistryPage.noPromptsDesc}</div>
                  </div>
                );
              }
              return (
                <div style={{ display: 'grid' }}>
                  {filtered.map((entry) => {
                    const statusKey = getPromptStatusKey(entry);
                    const label =
                      statusKey && t.promptRegistryPage[statusKey]
                        ? t.promptRegistryPage[statusKey]
                        : '';
                    const pillColor =
                      statusKey === 'active'
                        ? colors.success
                        : statusKey === 'pilot'
                        ? colors.warning
                        : statusKey === 'retired'
                        ? colors.textMuted
                        : colors.textMuted;
                    return (
                      <div
                        key={entry.id}
                        style={{
                          padding: '12px 20px',
                          borderBottom: `1px solid ${colors.border}`,
                          display: 'grid',
                          gridTemplateColumns: '120px 100px 100px 1fr 180px',
                          gap: '16px',
                          fontSize: '13px',
                          alignItems: 'center',
                          background: colors.card,
                        }}
                      >
                        <div>{entry.id}</div>
                        <div>{entry.step}</div>
                        <div>{entry.version}</div>
                        <div>{entry.description ?? ''}</div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {label ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '4px 10px',
                                  borderRadius: '999px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  color: '#fff',
                                  background: pillColor,
                                }}
                              >
                                {label}
                              </span>
                            ) : (
                              <span style={{ fontSize: '12px', color: colors.textMuted }}>—</span>
                            )}
                            <button
                              disabled={statusKey === 'active' || promptLoading}
                              onClick={async () => {
                                try {
                                  setPromptLoading(true);
                                  setPromptError(null);
                                  const rows = await applyActivePromptSelection(entry.step, entry.id, {
                                    setActivePromptApi: setActivePrompt as any,
                                    fetchPromptRegistryApi: fetchPromptRegistry as any,
                                  });
                                  if (rows) setPromptEntries(rows as any[]);
                                } catch (err: any) {
                                  setPromptError(err?.message ?? 'Failed to set active prompt');
                                } finally {
                                  setPromptLoading(false);
                                }
                              }}
                              style={{
                                borderRadius: '999px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: 600,
                                border: `1px solid ${colors.border}`,
                                background:
                                  statusKey === 'active' ? colors.sidebar : colors.card,
                                color:
                                  statusKey === 'active'
                                    ? colors.textMuted
                                    : colors.text,
                                cursor:
                                  statusKey === 'active' || promptLoading
                                    ? 'not-allowed'
                                    : 'pointer',
                                opacity:
                                  statusKey === 'active' || promptLoading ? 0.6 : 1,
                              }}
                            >
                              {statusKey === 'active'
                                ? 'Active'
                                : 'Set active'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* API Endpoints Info */}
          <div style={{ marginTop: '32px', background: colors.sidebar, border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Available API Endpoints</h3>
              <span style={{ fontSize: '11px', fontWeight: 600, color: colors.orange, background: colors.orangeLight, padding: '2px 8px', borderRadius: '4px' }}>COMING SOON</span>
            </div>
            <div style={{ display: 'grid', gap: '12px', fontSize: '13px', color: colors.textMuted }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ fontWeight: 600, color: colors.success, fontFamily: 'monospace' }}>GET</span>
                <span style={{ fontFamily: 'monospace' }}>/api/prompt-registry</span>
                <span>— List all prompts (filter by step)</span>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ fontWeight: 600, color: colors.warning, fontFamily: 'monospace' }}>POST</span>
                <span style={{ fontFamily: 'monospace' }}>/api/prompt-registry</span>
                <span>— Create new prompt entry</span>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ fontWeight: 600, color: colors.success, fontFamily: 'monospace' }}>GET</span>
                <span style={{ fontFamily: 'monospace' }}>/api/prompt-registry/active</span>
                <span>— Get active prompt for step</span>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ fontWeight: 600, color: colors.warning, fontFamily: 'monospace' }}>POST</span>
                <span style={{ fontFamily: 'monospace' }}>/api/prompt-registry/active</span>
                <span>— Set active prompt for step</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Pipeline view - show pipeline steps and configuration sidebar
    return (
      <>
        {/* Pipeline Steps Bar */}
        <div style={{ background: colors.sidebar, borderBottom: `1px solid ${colors.border}`, padding: '20px 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {pipeline.map((step, index) => (
              <div key={step.id} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <button
                  onClick={() => !step.locked && !step.comingSoon && setCurrentStep(step.id)}
                  disabled={step.locked || step.comingSoon}
                  style={{
                    background: completed[step.id] ? colors.orange : currentStep === step.id ? colors.orangeLight : 'transparent',
                    border: `2px solid ${completed[step.id] || currentStep === step.id ? colors.orange : colors.border}`,
                    color: completed[step.id] ? '#FFF' : currentStep === step.id ? colors.orange : step.locked || step.comingSoon ? colors.textMuted : colors.text,
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: step.locked || step.comingSoon ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: currentStep === step.id ? 600 : 500,
                    opacity: step.locked || step.comingSoon ? 0.5 : 1,
                    transition: 'all 0.2s ease',
                    width: '100%',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    position: 'relative',
                  }}
                >
                  <div>{step.number}. {step.label}</div>
                  {step.comingSoon && (
                    <div style={{
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
                    }}>
                      Soon
                    </div>
                  )}
                </button>
                {index < pipeline.length - 1 && (
                  <div style={{ width: '16px', height: '2px', background: completed[pipeline[index + 1].id] ? colors.orange : colors.border, margin: '0 4px' }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content with Sidebar */}
        <div style={{ display: 'flex', flex: 1 }}>
          {/* Configuration Sidebar */}
          <div style={{ width: '320px', background: colors.sidebar, borderRight: `1px solid ${colors.border}`, padding: '32px 24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: colors.textMuted, marginBottom: '24px' }}>
              {t.currentConfig}
            </h3>

            <div style={{ display: 'grid', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '12px', color: colors.textMuted, marginBottom: '8px', fontWeight: 600 }}>
                  {t.steps.icp.label}
                </div>
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
                    {icpSummary && (
                      <div
                        style={{
                          marginTop: '6px',
                          fontSize: '12px',
                          color: colors.textMuted,
                          lineHeight: '1.4',
                          fontWeight: 400,
                        }}
                      >
                        {icpSummary.valueProp && (
                          <div>Value prop: {icpSummary.valueProp}</div>
                        )}
                        {icpSummary.industries && icpSummary.industries.length > 0 && (
                          <div>
                            Industries: {icpSummary.industries.join(', ')}
                            {icpSummary.companySizes && icpSummary.companySizes.length
                              ? ` (${icpSummary.companySizes.join(', ')})`
                              : ''}
                          </div>
                        )}
                        {icpSummary.pains && icpSummary.pains.length > 0 && (
                          <div>Pains: {icpSummary.pains.join(', ')}</div>
                        )}
                        {icpSummary.triggers && icpSummary.triggers.length > 0 && (
                          <div>Triggers: {icpSummary.triggers.join(', ')}</div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '14px', color: colors.textMuted, fontStyle: 'italic' }}>
                    {t.notSelected}
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: '12px', color: colors.textMuted, marginBottom: '8px', fontWeight: 600 }}>
                  {t.steps.hypothesis.label}
                </div>
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
                    {hypothesisSummary && (
                      <div
                        style={{
                          marginTop: '6px',
                          fontSize: '12px',
                          color: colors.textMuted,
                          lineHeight: '1.4',
                          fontWeight: 400,
                        }}
                      >
                        {hypothesisSummary.regions && hypothesisSummary.regions.length > 0 && (
                          <div>Region: {hypothesisSummary.regions.join(', ')}</div>
                        )}
                        {hypothesisSummary.offers && hypothesisSummary.offers.length > 0 && (
                          <div>
                            Offers:{' '}
                            {hypothesisSummary.offers
                              .map((o: any) => `${o.personaRole ?? 'Persona'} – ${o.offer}`)
                              .join('; ')}
                          </div>
                        )}
                        {hypothesisSummary.critiques && hypothesisSummary.critiques.length > 0 && (
                          <div>
                            Critiques:{' '}
                            {hypothesisSummary.critiques
                              .map((c: any) => c.roast)
                              .filter(Boolean)
                              .join('; ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '14px', color: colors.textMuted, fontStyle: 'italic' }}>
                    {t.notSelected}
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: '12px', color: colors.textMuted, marginBottom: '8px', fontWeight: 600 }}>
                  {t.steps.segment.label}
                </div>
                {completed.segment ? (
                  <div style={{ background: colors.card, border: `1px solid ${colors.orange}`, borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 500 }}>
                    {completed.segment.name}
                  </div>
                ) : (
                  <div style={{ fontSize: '14px', color: colors.textMuted, fontStyle: 'italic' }}>
                    {t.notSelected}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Workspace */}
          <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
            {renderStepContent()}
          </div>
        </div>
      </>
    );
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.bg,
        color: colors.text,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        transition: 'all 0.3s ease',
        display: 'flex',
      }}
      onClick={() => showLanguageMenu && setShowLanguageMenu(false)}
    >
      {/* Left Navigation Sidebar */}
      <div style={{
        width: sidebarExpanded ? '240px' : '72px',
        background: colors.navSidebar,
        borderRight: `1px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s ease',
      }}>
        {/* Logo Section - aligned with Top Bar */}
        <div style={{ 
          height: '110px', // Fixed height to match Top Bar content area
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ 
            width: '56px', 
            height: '56px', 
            background: colors.orange, 
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            fontWeight: 700,
            color: '#FFF'
          }}>
            C5
          </div>
        </div>

        {/* Navigation Section - starts below separator */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: '20px', paddingBottom: '20px' }}>
          {/* Main Navigation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 12px' }}>
            {navItems.map((navItem) => {
              const isActive = currentPage === navItem.page;
              const buttonStyle = {
                background: isActive ? colors.orangeLight : 'transparent',
                border: `2px solid ${isActive ? colors.orange : 'transparent'}`,
                color: isActive ? colors.orange : colors.textMuted,
                width: sidebarExpanded ? '216px' : '48px',
                height: '48px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: sidebarExpanded ? '15px' : '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                fontWeight: 600,
                padding: 0,
              };
              const labelStyle = {
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: sidebarExpanded ? 'flex-start' : 'center',
                paddingLeft: sidebarExpanded ? '16px' : '0',
                textAlign: sidebarExpanded ? 'left' : 'center',
              };
              return (
                <button
                  key={navItem.page}
                  onClick={() => setCurrentPage(navItem.page)}
                  style={buttonStyle}
                  title={navItem.title}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = colors.cardHover;
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span style={labelStyle}>
                    {sidebarExpanded ? navItem.label : navItem.short}
                  </span>
                </button>
              );
            })}
          </div>

        {/* Bottom: Collapse Toggle, Settings & Services */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 12px', borderTop: `1px solid ${colors.border}`, paddingTop: '16px' }}>
          {/* Toggle Button */}
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
              color: colors.textMuted,
              width: sidebarExpanded ? '216px' : '48px',
              height: '40px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarExpanded ? 'space-between' : 'center',
              paddingLeft: sidebarExpanded ? '16px' : '0',
              paddingRight: sidebarExpanded ? '16px' : '0',
              transition: 'all 0.2s ease',
              fontWeight: 500,
              marginBottom: '8px',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.orange; e.currentTarget.style.backgroundColor = colors.orangeLight; e.currentTarget.style.color = colors.orange; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.backgroundColor = colors.card; e.currentTarget.style.color = colors.textMuted; }}
          >
            {sidebarExpanded ? (
              <>
                <span>{t.collapseNav}</span>
                <span>←</span>
              </>
            ) : (
              <span>→</span>
            )}
          </button>

          <button
            onClick={() => setShowSettings(true)}
            style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              width: sidebarExpanded ? '216px' : '48px',
              height: '48px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: sidebarExpanded ? '15px' : '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarExpanded ? 'flex-start' : 'center',
              paddingLeft: sidebarExpanded ? '16px' : '0',
              gap: sidebarExpanded ? '12px' : '0',
              transition: 'all 0.2s ease',
              fontWeight: 600,
            }}
            title={t.settings}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.orange; e.currentTarget.style.backgroundColor = colors.orangeLight; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.backgroundColor = colors.card; }}
          >
            <span>⚙</span>
            {sidebarExpanded && <span style={{ fontWeight: 600 }}>{t.settings}</span>}
          </button>

          <button
            onClick={() => setShowServices(true)}
            style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              width: sidebarExpanded ? '216px' : '48px',
              height: '48px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: sidebarExpanded ? '15px' : '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarExpanded ? 'flex-start' : 'center',
              paddingLeft: sidebarExpanded ? '16px' : '0',
              gap: sidebarExpanded ? '12px' : '0',
              transition: 'all 0.2s ease',
              fontWeight: 600,
            }}
            title={t.services}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.orange; e.currentTarget.style.backgroundColor = colors.orangeLight; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.backgroundColor = colors.card; }}
          >
            <span>🔌</span>
            {sidebarExpanded && <span style={{ fontWeight: 600 }}>{t.services}</span>}
          </button>
        </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top Bar with Hero Header */}
        <div style={{ 
          height: '110px', // Fixed height to match Logo section
          background: colors.sidebar, 
          borderBottom: `1px solid ${colors.border}`, 
          padding: '0 32px',
          display: 'flex',
          alignItems: 'center',
        }}>
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '32px' }}>
            {/* Left: Hero Text */}
            <div style={{ flex: 1 }}>
              <h1 style={{
                fontSize: '28px',
                fontWeight: 700,
                marginBottom: '8px',
                lineHeight: '1.2',
              }}>
                {t.hero.title1}
                <span style={{ color: colors.orange }}>{t.hero.title2}</span>
                {t.hero.title3}
              </h1>
              <p style={{
                fontSize: '14px',
                color: colors.textMuted,
                lineHeight: '1.5',
              }}>
                {t.hero.subtitle}
              </p>
              <p
                style={{
                  fontSize: '12px',
                  color: colors.textMuted,
                  marginTop: '4px',
                }}
              >
                {(() => {
                  const connected = services.filter((s) => s.hasApiKey);
                  const llmCount = connected.filter((s) => s.category === 'llm').length;
                  const enrichmentCount = connected.filter((s) => s.category === 'enrichment').length;
                  const deliveryCount = connected.filter((s) => s.category === 'delivery').length;
                  return (
                    <>
                      API base: {apiBase} · Mode: {modeLabel} · Supabase:{' '}
                      {supabaseReady ? 'ready' : 'missing'} · Smartlead:{' '}
                      {smartleadReady ? 'ready' : 'not ready'} · LLMs: {llmCount} · Enrichment:{' '}
                      {enrichmentCount} · Delivery: {deliveryCount}
                    </>
                  );
                })()}
              </p>
            </div>

            {/* Right: Controls */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
              {/* Future: User profile/login button will go here */}

              {/* Language Selector */}
              <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                  style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.text, width: '52px', height: '40px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {languages.find(l => l.code === language)?.label}
                </button>
                {showLanguageMenu && (
                  <div style={{ position: 'absolute', top: '48px', right: 0, background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '180px', zIndex: 200 }}>
                    {languages.map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => { setLanguage(lang.code); setShowLanguageMenu(false); }}
                        style={{
                          width: '100%',
                          background: language === lang.code ? colors.orangeLight : 'transparent',
                          border: 'none',
                          color: language === lang.code ? colors.orange : colors.text,
                          padding: '12px 16px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: language === lang.code ? 600 : 500,
                          borderBottom: `1px solid ${colors.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                        onMouseEnter={(e) => { if (language !== lang.code) e.currentTarget.style.backgroundColor = colors.cardHover; }}
                        onMouseLeave={(e) => { if (language !== lang.code) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <span>{lang.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setIsDark(!isDark)}
                style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.text, width: '40px', height: '40px', borderRadius: '8px', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {isDark ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {renderPageContent()}
        </div>
      </div>

      {/* AI Chat Modal */}
      {showAIChat && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: colors.card, borderRadius: '16px', width: '90%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '24px', borderBottom: `1px solid ${colors.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 700 }}>{t.aiChat.title}</h3>
                <button
                  onClick={() => {
                    setShowAIChat(false);
                    setAiTranscript([]);
                    setAiMessage('');
                    setAiError(null);
                  }}
                  style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: '24px', cursor: 'pointer', padding: '0', width: '32px', height: '32px' }}
                >
                  ×
                </button>
              </div>
            </div>

            <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
              <div style={{ background: colors.sidebar, borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                <p style={{ fontSize: '14px', lineHeight: '1.6', color: colors.text }}>
                  {t.aiChat.greeting} <span style={{ fontWeight: 600, color: colors.orange }}>{currentStep}</span>. {t.aiChat.greeting2}
                </p>
              </div>

              {aiTranscript.length > 0 && (
                <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {aiTranscript.map((msg, index) => (
                    <div
                      key={index}
                      style={{
                        alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                        padding: '8px 12px',
                        borderRadius: '12px',
                        background: msg.role === 'user' ? colors.orange : colors.sidebar,
                        color: msg.role === 'user' ? '#FFF' : colors.text,
                        fontSize: '13px',
                        lineHeight: '1.5',
                      }}
                    >
                      {msg.text}
                    </div>
                  ))}
                </div>
              )}

              {aiError && (
                <div
                  style={{
                    marginBottom: '12px',
                    fontSize: '12px',
                    color: colors.error,
                  }}
                >
                  {aiError}
                </div>
              )}
            </div>

            <div style={{ padding: '24px', borderTop: `1px solid ${colors.border}` }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  placeholder={t.aiChat.placeholder}
                  style={{
                    flex: 1,
                    background: colors.sidebar,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    color: colors.text,
                    outline: 'none',
                  }}
                  value={aiMessage}
                  onChange={(e) => setAiMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !aiLoading) {
                      e.preventDefault();
                      handleAiSend().catch(() => null);
                    }
                  }}
                />
                <button
                  onClick={() => handleAiSend().catch(() => null)}
                  style={{
                    background: colors.orange,
                    color: '#FFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  disabled={aiLoading}
                >
                  {aiLoading ? '…' : t.aiChat.send}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: colors.card, borderRadius: '16px', width: '90%', maxWidth: '800px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '24px', borderBottom: `1px solid ${colors.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 700 }}>{t.settingsModal.title}</h3>
                <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: '24px', cursor: 'pointer', padding: '0', width: '32px', height: '32px' }}>×</button>
              </div>
            </div>

            <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
              {/* Service Providers - Unified */}
              <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 600 }}>Service Providers</h4>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: colors.orange, background: colors.orangeLight, padding: '2px 8px', borderRadius: '4px' }}>COMING SOON</span>
                </div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {services.map(service => {
                    const statusIcon = service.status === 'connected' ? '🟢' : service.status === 'warning' ? '🟡' : '🔴';
                    return (
                      <div key={service.name} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '12px 16px', 
                        background: colors.sidebar, 
                        borderRadius: '8px', 
                        border: `1px solid ${colors.border}` 
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                          <span style={{ fontSize: '14px' }}>{statusIcon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 600 }}>{service.name}</div>
                            <div style={{ fontSize: '11px', color: colors.textMuted }}>
                              {t.servicesModal.categories[service.category] ?? service.category}
                            </div>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {service.hasApiKey ? (
                            <>
                              <span style={{ 
                                fontSize: '11px', 
                                fontWeight: 600, 
                                color: '#22c55e', 
                                background: isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.2)', 
                                padding: '4px 8px', 
                                borderRadius: '4px',
                                whiteSpace: 'nowrap'
                              }}>
                                ✓ in .env
                              </span>
                              <label style={{ 
                                position: 'relative', 
                                display: 'inline-block', 
                                width: '44px', 
                                height: '24px', 
                                cursor: 'not-allowed', 
                                opacity: 0.5 
                              }}>
                                <input type="checkbox" checked={service.status === 'connected'} disabled style={{ opacity: 0, width: 0, height: 0 }} />
                                <span style={{ 
                                  position: 'absolute', 
                                  cursor: 'not-allowed',
                                  inset: 0, 
                                  background: service.status === 'connected' ? '#22c55e' : colors.border, 
                                  borderRadius: '24px', 
                                  transition: 'background 0.3s' 
                                }}></span>
                                <span style={{ 
                                  position: 'absolute', 
                                  left: service.status === 'connected' ? '22px' : '2px', 
                                  top: '2px', 
                                  width: '20px', 
                                  height: '20px', 
                                  background: '#FFF', 
                                  borderRadius: '50%', 
                                  transition: 'left 0.3s' 
                                }}></span>
                              </label>
                            </>
                          ) : (
                            <>
                              <span style={{ 
                                fontSize: '11px', 
                                fontWeight: 600, 
                                color: '#ef4444', 
                                background: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.2)', 
                                padding: '4px 8px', 
                                borderRadius: '4px',
                                whiteSpace: 'nowrap'
                              }}>
                                ⚠️ missing
                              </span>
                              <button
                                disabled
                                style={{
                                  background: colors.orangeLight,
                                  border: `1px solid ${colors.orange}`,
                                  color: colors.orange,
                                  padding: '6px 16px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'not-allowed',
                                  opacity: 0.6,
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                Set up
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Services Modal */}
      {showServices && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: colors.card, borderRadius: '16px', width: '90%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '24px', borderBottom: `1px solid ${colors.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 700 }}>{t.servicesModal.title}</h3>
                <button onClick={() => setShowServices(false)} style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: '24px', cursor: 'pointer', padding: '0', width: '32px', height: '32px' }}>×</button>
              </div>
            </div>

            <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gap: '12px' }}>
                {services.map(service => {
                  const statusColor = service.status === 'connected' ? colors.success : service.status === 'warning' ? colors.warning : colors.error;
                  return (
                    <div key={service.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: colors.sidebar, borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>{service.name}</div>
                        <div style={{ fontSize: '12px', color: colors.textMuted }}>
                          {t.servicesModal.categories[service.category] ?? service.category}
                        </div>
                      </div>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: statusColor }} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <SegmentBuilder
        isOpen={showSegmentBuilder}
        onClose={() => setShowSegmentBuilder(false)}
        onCreate={handleCreateSegment}
      />

      <ExaWebsetSearch
        isOpen={showExaWebsetSearch}
        onClose={() => setShowExaWebsetSearch(false)}
        onSave={handleSaveExaSegment}
      />
    </div>
  );
}

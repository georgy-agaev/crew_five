export type CoachRunMode = 'create' | 'refine';

const DISCOVERY_STORAGE_KEY = 'c5_latest_icp_discovery';

type SummaryRecord = Record<string, unknown>;
type CoachEntity = { id?: unknown } & Record<string, unknown>;
type DiscoveryRunMeta = {
  runId: string;
  icpProfileId?: string | null;
  icpHypothesisId?: string | null;
};
type CompletedState = {
  icp?: { id?: unknown } | null;
  hypothesis?: { id?: unknown } | null;
};

function asRecord(value: unknown): SummaryRecord {
  return value && typeof value === 'object' ? (value as SummaryRecord) : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function formatIcpSummaryForChat(summary: unknown) {
  const data = asRecord(summary);
  if (!summary) return '';
  const parts: string[] = [];
  if (typeof data.valueProp === 'string' && data.valueProp) parts.push(`Value prop: ${data.valueProp}`);
  const industries = asStringArray(data.industries);
  if (industries.length) {
    let text = `Target industries: ${industries.join(', ')}`;
    const companySizes = asStringArray(data.companySizes);
    if (companySizes.length) {
      text += ` (${companySizes.join(', ')})`;
    }
    parts.push(text);
  }
  const pains = asStringArray(data.pains);
  if (pains.length) parts.push(`Key pains: ${pains.join(', ')}`);
  const triggers = asStringArray(data.triggers);
  if (triggers.length) parts.push(`Buying triggers: ${triggers.join(', ')}`);
  return parts.join(' · ');
}

export function formatHypothesisSummaryForChat(summary: unknown) {
  const data = asRecord(summary);
  if (!summary) return '';
  const parts: string[] = [];
  if (typeof data.label === 'string' && data.label) parts.push(`Hypothesis: ${data.label}`);
  const regions = asStringArray(data.regions);
  if (regions.length) {
    parts.push(`Regions: ${regions.join(', ')}`);
  }
  const offers = Array.isArray(data.offers) ? data.offers : [];
  if (offers.length) {
    const first = asRecord(offers[0]);
    const offer = typeof first.offer === 'string' ? first.offer : '';
    const personaRole = typeof first.personaRole === 'string' ? first.personaRole : '';
    const offerLabel = personaRole ? `${personaRole}: ${offer}` : offer;
    if (offerLabel) parts.push(`Offer: ${offerLabel}`);
  }
  const critiques = Array.isArray(data.critiques) ? data.critiques : [];
  if (critiques.length) {
    const firstCrit = asRecord(critiques[0]);
    const critiqueText =
      typeof firstCrit.roast === 'string'
        ? firstCrit.roast
        : typeof firstCrit.suggestion === 'string'
          ? firstCrit.suggestion
          : '';
    if (critiqueText) parts.push(`Critique: ${critiqueText}`);
  }
  return parts.join(' · ');
}

export function appendChatMessage(messages: SummaryRecord[] | null | undefined, message: SummaryRecord) {
  const base = Array.isArray(messages) ? messages : [];
  return [...base, message];
}

export function appendInteractiveCoachMessage(
  messages: SummaryRecord[] | null | undefined,
  message: SummaryRecord
) {
  const base = Array.isArray(messages) ? messages : [];
  const enriched = { ...message, step: message.step, entityId: message.entityId };
  return appendChatMessage(base, enriched).slice(-8);
}

export function buildInteractiveIcpPrompt(summary: unknown | null, userInput: string) {
  if (!summary) return userInput;
  const summaryText = formatIcpSummaryForChat(summary);
  if (!summaryText) return userInput;
  return ['Current ICP summary:', summaryText, '', 'New input from user:', userInput].join('\n');
}

export function buildInteractiveHypothesisPrompt(summary: unknown | null, userInput: string) {
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

export function persistLatestDiscoveryRun(meta: DiscoveryRunMeta) {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(DISCOVERY_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // best-effort only; ignore storage errors
  }
}

export function getPersistedDiscoveryRun():
  | DiscoveryRunMeta
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
  return !!getPersistedDiscoveryRun()?.runId;
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
  const search = new URLSearchParams(buildDiscoveryLinkParams(meta)).toString();
  const base = window.location.href.split('?')[0];
  const url = `${base}?${search}`;
  try {
    window.location.assign(url);
  } catch {
    // jsdom can throw on navigation; best-effort only
  }
  return url;
}

export function buildIcpSummaryFromProfile(profile: unknown) {
  if (!profile) return null;
  const data = asRecord(profile);
  const company = asRecord(data.company_criteria);
  const persona = asRecord(data.persona_criteria);
  const phases = asRecord(data.phase_outputs);
  const phase1 = asRecord(phases.phase1);
  const phase2 = asRecord(phases.phase2);
  const phase3 = asRecord(phases.phase3);
  const industryAndSize = asRecord(phase2.industryAndSize);

  return {
    valueProp: typeof phase1.valueProp === 'string' ? phase1.valueProp : company.valueProp ?? null,
    industries: asStringArray(industryAndSize.industries).length
      ? asStringArray(industryAndSize.industries)
      : asStringArray(company.industries),
    companySizes: asStringArray(industryAndSize.companySizes).length
      ? asStringArray(industryAndSize.companySizes)
      : asStringArray(company.companySizes),
    pains: asStringArray(phase2.pains).length ? asStringArray(phase2.pains) : asStringArray(company.pains),
    decisionMakers: asArray(phase2.decisionMakers).length
      ? asArray(phase2.decisionMakers)
      : asArray(persona.decisionMakers),
    triggers: asStringArray(phase3.triggers).length ? asStringArray(phase3.triggers) : asStringArray(company.triggers),
    dataSources: asArray(phase3.dataSources).length ? asArray(phase3.dataSources) : asArray(company.dataSources),
  };
}

export function buildHypothesisSummaryFromSearchConfig(hypothesis: unknown) {
  if (!hypothesis) {
    return { label: '', regions: [], offers: [], critiques: [] };
  }
  const data = asRecord(hypothesis);
  const searchConfig = asRecord(data.search_config);
  const phases = asRecord(searchConfig.phases);
  const phase4 = asRecord(phases.phase4);
  const phase5 = asRecord(phases.phase5);
  return {
    label:
      typeof data.hypothesis_label === 'string'
        ? data.hypothesis_label
        : typeof data.hypothesisLabel === 'string'
          ? data.hypothesisLabel
          : '',
    regions: asStringArray(searchConfig.region),
    offers: Array.isArray(phase4.offers) ? phase4.offers : [],
    critiques: Array.isArray(phase5.critiques) ? phase5.critiques : [],
  };
}

export function resolveCoachRunMode(
  currentStep: string,
  completed: CompletedState,
  preferredMode?: CoachRunMode | null
): CoachRunMode {
  if (preferredMode === 'create' || preferredMode === 'refine') return preferredMode;
  if (currentStep === 'icp') return completed?.icp?.id ? 'refine' : 'create';
  if (currentStep === 'hypothesis') return completed?.hypothesis?.id ? 'refine' : 'create';
  return 'create';
}

export function applyCoachResultToState(
  mode: CoachRunMode,
  entity: 'icp' | 'hypothesis',
  result: CoachEntity,
  profiles: CoachEntity[],
  hypotheses: CoachEntity[],
  completed: CompletedState
): { profiles: CoachEntity[]; hypotheses: CoachEntity[] } {
  if (entity === 'icp') {
    const existing = Array.isArray(profiles) ? profiles : [];
    const selectedIcpId = completed.icp?.id;
    return {
      profiles:
        mode === 'refine' && selectedIcpId
          ? [result, ...existing.filter((profile) => profile?.id !== selectedIcpId)]
          : [result, ...existing],
      hypotheses,
    };
  }

  const existingHyps = Array.isArray(hypotheses) ? hypotheses : [];
  const selectedHypothesisId = completed.hypothesis?.id;
  return {
    profiles,
    hypotheses:
      mode === 'refine' && selectedHypothesisId
        ? [result, ...existingHyps.filter((hypothesis) => hypothesis?.id !== selectedHypothesisId)]
        : [result, ...existingHyps],
  };
}

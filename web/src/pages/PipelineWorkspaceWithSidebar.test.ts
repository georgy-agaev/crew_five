import { describe, expect, it, vi } from 'vitest';

import {
  formatDraftSummary,
  formatSendSummary,
  getPromptStatusKey,
  aggregateAnalyticsMetrics,
  formatAnalyticsGroupKey,
  mapEnrichmentErrorMessage,
  getActivePromptIdForStep,
  // helper used to normalize prompt create form payloads
  buildPromptCreateEntry,
  // helpers for prompt/task wiring
  mapTaskToPromptStep,
  getPromptOptionsForStep,
  getPromptOptions,
  getTaskSelectionLabel,
  setTaskPrompt,
  applyActivePromptSelection,
  mapTaskToProviderKey,
  mapLlmModelsErrorMessage,
  buildIcpSummaryFromProfile,
  buildHypothesisSummaryFromSearchConfig,
  formatIcpSummaryForChat,
  formatHypothesisSummaryForChat,
  appendChatMessage,
  appendInteractiveCoachMessage,
  buildInteractiveIcpPrompt,
  buildInteractiveHypothesisPrompt,
  persistLatestDiscoveryRun,
  getPersistedDiscoveryRun,
  buildDiscoveryLinkParams,
  openIcpDiscoveryForLatestRun,
  hasPersistedDiscoveryRun,
  resolveCoachRunMode,
  applyCoachResultToState,
} from './PipelineWorkspaceWithSidebar';

const memorySessionStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key: string, value: string) {
      store[key] = String(value);
    },
    removeItem(key: string) {
      delete store[key];
    },
    clear() {
      store = {};
    },
  };
})();

(globalThis as any).window = (globalThis as any).window || {
  sessionStorage: memorySessionStorage,
  location: {
    href: 'http://localhost:5173/',
    search: '',
    assign: vi.fn(),
  },
};

describe('PipelineWorkspaceWithSidebar helpers', () => {
  it('formats draft summary with modes and dryRun flag', () => {
    const summary = formatDraftSummary({
      generated: 42,
      dryRun: true,
      dataQualityMode: 'strict',
      interactionMode: 'express',
    });
    expect(summary).toBe(
      'Drafts ready: generated=42, dryRun=true, modes=strict/express'
    );
  });

  it('formats send summary without truncation', () => {
    const summary = formatSendSummary({ fetched: 10, sent: 8, skipped: 2 }, 0);
    expect(summary).toBe('Smartlead preview: fetched=10, sent=8, skipped=2');
  });

  it('formats send summary with truncation note when truncated > 0', () => {
    const summary = formatSendSummary({ fetched: 20, sent: 15, skipped: 5 }, 7);
    expect(summary).toBe(
      'Smartlead preview: fetched=20, sent=15, skipped=5 (truncated preview by 7)'
    );
  });

  it('returns active status key when entry is active', () => {
    const key = getPromptStatusKey({ is_active: true, rollout_status: 'pilot' });
    expect(key).toBe('active');
  });

  it('returns rollout_status when not active', () => {
    const key = getPromptStatusKey({ rollout_status: 'pilot' });
    expect(key).toBe('pilot');
  });

  it('returns empty status key when neither active nor rollout_status', () => {
    const key = getPromptStatusKey({});
    expect(key).toBe('');
  });

  it('aggregates analytics rows into totals', () => {
    const rows = [
      { delivered: 10, opened: 5, replied: 2, positive_replies: 1 },
      { delivered: 5, opened: 3, replied: 1, positive_replies: 0 },
    ];
    const result = aggregateAnalyticsMetrics(rows as any);
    expect(result.delivered).toBe(15);
    expect(result.opened).toBe(8);
    expect(result.replied).toBe(3);
    expect(result.positive).toBe(1);
  });

  it('treats missing fields as zero when aggregating analytics', () => {
    const rows = [{}];
    const result = aggregateAnalyticsMetrics(rows as any);
    expect(result.delivered).toBe(0);
    expect(result.opened).toBe(0);
    expect(result.replied).toBe(0);
    expect(result.positive).toBe(0);
  });

  it('maps no segment members enrichment error to friendly message', () => {
    const err = new Error('No segment members found for finalized segment');
    const msg = mapEnrichmentErrorMessage(err);
    expect(msg.toLowerCase()).toContain('no finalized members');
    expect(msg.toLowerCase()).toContain('enrichment');
  });

  it('falls back to raw message or default for other enrichment errors', () => {
    const err = new Error('Some other failure');
    const msg = mapEnrichmentErrorMessage(err);
    expect(msg).toBe('Some other failure');

    const defaultMsg = mapEnrichmentErrorMessage(undefined);
    expect(defaultMsg).toBe('Failed to enqueue enrichment');
  });

  it('getActivePromptIdForStep returns active id for step', () => {
    const entries = [
      { id: 'draft_v1', step: 'draft', rollout_status: 'pilot' },
      { id: 'draft_v2', step: 'draft', rollout_status: 'active' },
      { id: 'icp_profile_v1', step: 'icp_profile', rollout_status: 'active' },
    ] as any;
    const activeDraft = getActivePromptIdForStep(entries, 'draft');
    const activeIcp = getActivePromptIdForStep(entries, 'icp_profile');
    expect(activeDraft).toBe('draft_v2');
    expect(activeIcp).toBe('icp_profile_v1');
  });

  it('getActivePromptIdForStep returns null when none active', () => {
    const entries = [
      { id: 'draft_v1', step: 'draft', rollout_status: 'pilot' },
    ] as any;
    const active = getActivePromptIdForStep(entries, 'draft');
    expect(active).toBeNull();
  });

  it('formats analytics group key for ICP grouping', () => {
    const row = { icp_profile_id: 'icp-1', icp_hypothesis_id: 'hyp-2' };
    const key = formatAnalyticsGroupKey('icp', row as any);
    expect(key).toBe('icp-1 / hyp-2');
  });

  it('formats analytics group key for segment grouping', () => {
    const row = { segment_id: 'seg-1', segment_version: 3, role: 'founder' };
    const key = formatAnalyticsGroupKey('segment', row as any);
    expect(key).toBe('seg-1@v3 (founder)');
  });

  it('formats analytics group key for pattern grouping', () => {
    const row = { draft_pattern: 'P0', user_edited: true };
    const key = formatAnalyticsGroupKey('pattern', row as any);
    expect(key).toBe('P0 [edited=true]');
  });

  it('builds prompt create entry payload with sensible defaults', () => {
    const form: any = {
      id: '  icp_profile_v1 ',
      version: ' v1 ',
      description: ' Test prompt ',
      prompt_text: '',
    };
    const payload = buildPromptCreateEntry(form);
    expect(payload.id).toBe('icp_profile_v1');
    expect(payload.version).toBe('v1');
    expect(payload.description).toBe('Test prompt');
    expect(payload.rollout_status).toBe('pilot');
    expect(payload.prompt_text).toBeUndefined();
  });

  it('builds prompt options from all entries (no step filtering)', () => {
    const entries: any[] = [
      { id: 'icp_v1', version: 'v1' },
      { id: 'hyp_v1', version: 'v1' },
      { id: 'draft_v1', version: 'v2' },
    ];
    const options = getPromptOptions(entries as any);
    expect(options.map((o) => o.value)).toEqual(['icp_v1', 'hyp_v1', 'draft_v1']);
    expect(options[0].label).toContain('icp_v1');
  });

  it('setTaskPrompt updates the correct task key', () => {
    const initial = {} as any;
    const updated = setTaskPrompt(initial, 'icpDiscovery', 'icp_v1');
    expect(updated.icpDiscovery).toBe('icp_v1');
    // other keys remain untouched
    expect(updated.hypothesisGen).toBeUndefined();
  });

  it('getTaskSelectionLabel reads from taskPrompts mapping', () => {
    const state = {
      icpDiscovery: 'icp_v1',
      hypothesisGen: 'hyp_v2',
    } as any;
    expect(getTaskSelectionLabel(state, 'icpDiscovery')).toBe('icp_v1');
    expect(getTaskSelectionLabel(state, 'emailDraft')).toBeNull();
  });

  it('maps task keys to prompt steps', () => {
    expect(mapTaskToPromptStep('icpDiscovery')).toBe('icp_profile');
    expect(mapTaskToPromptStep('hypothesisGen')).toBe('icp_hypothesis');
    expect(mapTaskToPromptStep('emailDraft')).toBe('draft');
    expect(mapTaskToPromptStep('linkedinMsg')).toBeNull();
  });

  it('maps task keys to provider keys', () => {
    expect(mapTaskToProviderKey('icpDiscovery')).toBe('icp');
    expect(mapTaskToProviderKey('hypothesisGen')).toBe('hypothesis');
    expect(mapTaskToProviderKey('emailDraft')).toBe('draft');
    expect(mapTaskToProviderKey('linkedinMsg')).toBe('draft');
  });

  it('builds prompt options for step from entries', () => {
    const entries: any[] = [
      { id: 'icp_v1', step: 'icp_profile', rollout_status: 'active' },
      { id: 'icp_v2', step: 'icp_profile', rollout_status: 'pilot' },
      { id: 'draft_v1', step: 'draft', rollout_status: 'active' },
    ];
    const options = getPromptOptionsForStep(entries, 'icp_profile');
    expect(options.map((o) => o.value)).toEqual(['icp_v1', 'icp_v2']);
    expect(options[0].label).toContain('icp_v1');
  });

  it('applies active prompt selection via helper', async () => {
    const setActive = vi.fn().mockResolvedValue(undefined);
    const fetchRegistry = vi.fn().mockResolvedValue([
      { id: 'icp_v1', step: 'icp_profile', rollout_status: 'active' },
    ]);
    const rows = await applyActivePromptSelection('icp_profile', 'icp_v1', {
      setActivePromptApi: setActive as any,
      fetchPromptRegistryApi: fetchRegistry as any,
    });
    expect(setActive).toHaveBeenCalledWith('icp_profile', 'icp_v1');
    expect(fetchRegistry).toHaveBeenCalledTimes(1);
    expect(rows?.length).toBe(1);
    expect(rows?.[0]?.id).toBe('icp_v1');
  });

  it('maps LLM models error to provider message when wrapped by API helper', () => {
    const err = new Error(
      'API error 500: OpenAI models error 401: Invalid API key provided.'
    );
    const msg = mapLlmModelsErrorMessage(err);
    expect(msg).toBe('OpenAI models error 401: Invalid API key provided.');
  });

  it('maps LLM models error and falls back to raw message when no API wrapper', () => {
    const err = new Error('OpenAI models error 401: Invalid API key provided.');
    const msg = mapLlmModelsErrorMessage(err);
    expect(msg).toBe('OpenAI models error 401: Invalid API key provided.');
  });

  it('buildIcpSummaryFromProfile prefers phase_outputs when present', () => {
    const profile: any = {
      name: 'AI SDR ICP',
      company_criteria: {
        valueProp: 'Fallback value prop',
        industries: ['FallbackIndustry'],
        companySizes: ['FallbackSize'],
        pains: ['Fallback pain'],
        triggers: ['Fallback trigger'],
      },
      persona_criteria: {
        decisionMakers: [{ role: 'Fallback VP Sales' }],
      },
      phase_outputs: {
        phase1: { valueProp: 'Primary value prop from phase1' },
        phase2: {
          industryAndSize: {
            industries: ['SaaS'],
            companySizes: ['50-500'],
          },
          pains: ['Manual triage'],
          decisionMakers: [{ role: 'VP Sales' }],
        },
        phase3: {
          triggers: ['New VP Sales hired'],
          dataSources: [{ source: 'LinkedIn', hint: 'Job changes' }],
        },
      },
    };

    const summary = buildIcpSummaryFromProfile(profile);
    expect(summary.valueProp).toBe('Primary value prop from phase1');
    expect(summary.industries).toEqual(['SaaS']);
    expect(summary.companySizes).toEqual(['50-500']);
    expect(summary.pains).toEqual(['Manual triage']);
    expect(summary.decisionMakers?.[0]?.role).toBe('VP Sales');
    expect(summary.triggers).toEqual(['New VP Sales hired']);
    expect(summary.dataSources?.[0]?.source).toBe('LinkedIn');
  });

  it('buildIcpSummaryFromProfile falls back to flattened criteria when phases missing', () => {
    const profile: any = {
      company_criteria: {
        valueProp: 'Flat value prop',
        industries: ['FlatIndustry'],
        companySizes: ['FlatSize'],
        pains: ['Flat pain'],
        triggers: ['Flat trigger'],
      },
      persona_criteria: {
        decisionMakers: [{ role: 'Flat VP Sales' }],
      },
    };

    const summary = buildIcpSummaryFromProfile(profile);
    expect(summary.valueProp).toBe('Flat value prop');
    expect(summary.industries).toEqual(['FlatIndustry']);
    expect(summary.companySizes).toEqual(['FlatSize']);
    expect(summary.pains).toEqual(['Flat pain']);
    expect(summary.decisionMakers?.[0]?.role).toBe('Flat VP Sales');
    expect(summary.triggers).toEqual(['Flat trigger']);
  });

  it('buildHypothesisSummaryFromSearchConfig uses phase offers and critiques', () => {
    const hypothesis: any = {
      hypothesis_label: 'Mid-market SaaS expansion',
      search_config: {
        region: ['EU'],
        phases: {
          phase4: {
            offers: [
              {
                personaRole: 'VP Sales',
                context: 'Mid-market SaaS',
                offer: 'Pipeline diagnostics workshop',
              },
            ],
          },
          phase5: {
            critiques: [
              {
                offerIndex: 0,
                roast: 'Too generic',
                suggestion: 'Add specific metrics and risk reversal',
              },
            ],
          },
        },
      },
    };

    const summary = buildHypothesisSummaryFromSearchConfig(hypothesis);
    expect(summary.label).toBe('Mid-market SaaS expansion');
    expect(summary.regions).toEqual(['EU']);
    expect(summary.offers?.[0]?.offer).toBe('Pipeline diagnostics workshop');
    expect(summary.critiques?.[0]?.roast).toBe('Too generic');
  });

  it('buildHypothesisSummaryFromSearchConfig handles missing phases gracefully', () => {
    const hypothesis: any = {
      hypothesis_label: 'Fallback hypothesis',
      search_config: {
        region: ['US'],
      },
    };

    const summary = buildHypothesisSummaryFromSearchConfig(hypothesis);
    expect(summary.label).toBe('Fallback hypothesis');
    expect(summary.regions).toEqual(['US']);
    expect(summary.offers).toEqual([]);
    expect(summary.critiques).toEqual([]);
  });

  it('formatIcpSummaryForChat_includes_value_prop_and_industries', () => {
    const summary = {
      valueProp: 'We solve X by doing Y.',
      industries: ['SaaS', 'Fintech'],
      companySizes: ['50-500'],
      pains: ['Manual triage'],
      triggers: ['New VP Sales hired'],
    };

    const text = formatIcpSummaryForChat(summary as any);
    expect(text).toContain('We solve X by doing Y.');
    expect(text).toContain('SaaS');
    expect(text).toContain('50-500');
  });

  it('formatHypothesisSummaryForChat_includes_label_offers_and_critiques', () => {
    const summary = {
      label: 'Mid-market SaaS expansion',
      regions: ['EU'],
      offers: [{ personaRole: 'VP Sales', offer: 'Pipeline diagnostics workshop' }],
      critiques: [{ roast: 'Too generic', suggestion: 'Add specific metrics' }],
    };

    const text = formatHypothesisSummaryForChat(summary as any);
    expect(text).toContain('Mid-market SaaS expansion');
    expect(text).toContain('EU');
    expect(text).toContain('Pipeline diagnostics workshop');
    expect(text).toContain('Too generic');
  });

  it('appendChatMessage_appends_messages_immutably', () => {
    const original = [{ role: 'user', text: 'Hi' }];
    const next = appendChatMessage(original as any, { role: 'assistant', text: 'Hello' } as any);
    expect(next).toHaveLength(2);
    expect(original).toHaveLength(1);
    expect(next[1].text).toBe('Hello');
  });

  it('appendInteractiveCoachMessage_tags_with_step_and_entity_and_trims_window', () => {
    const base = [{ role: 'user', text: 'Hi', step: 'icp', entityId: 'icp-1' }];
    let transcript: any[] = base;
    for (let i = 0; i < 10; i += 1) {
      transcript = appendInteractiveCoachMessage(transcript as any, {
        role: 'assistant',
        text: `Round ${i}`,
        step: 'icp',
        entityId: 'icp-1',
      } as any);
    }
    expect(transcript.length).toBeLessThanOrEqual(8);
    const last = transcript[transcript.length - 1] as any;
    expect(last.text).toBe('Round 9');
    expect(last.step).toBe('icp');
    expect(last.entityId).toBe('icp-1');
  });

  it('buildInteractiveIcpPrompt_includes_summary_and_user_input_when_summary_present', () => {
    const summary: any = {
      valueProp: 'We solve X by doing Y.',
      industries: ['SaaS'],
      companySizes: ['50-500'],
      pains: ['Manual triage'],
      triggers: ['New VP Sales hired'],
    };
    const prompt = buildInteractiveIcpPrompt(summary, 'Please refine for PLG teams.');
    expect(prompt).toContain('We solve X by doing Y.');
    expect(prompt).toContain('SaaS');
    expect(prompt).toContain('Please refine for PLG teams.');
  });

  it('buildInteractiveIcpPrompt_falls_back_to_user_input_when_no_summary', () => {
    const prompt = buildInteractiveIcpPrompt(null as any, 'Fresh ICP description');
    expect(prompt).toBe('Fresh ICP description');
  });

  it('buildInteractiveHypothesisPrompt_includes_label_offers_and_user_input', () => {
    const summary: any = {
      label: 'Mid-market EU SaaS',
      regions: ['EU'],
      offers: [{ personaRole: 'VP Sales', offer: 'Pipeline diagnostics workshop' }],
      critiques: [{ roast: 'Too generic', suggestion: 'Add metrics' }],
    };
    const prompt = buildInteractiveHypothesisPrompt(summary, 'Tighten focus on PLG motion.');
    expect(prompt).toContain('Mid-market EU SaaS');
    expect(prompt).toContain('Pipeline diagnostics workshop');
    expect(prompt).toContain('Tighten focus on PLG motion.');
  });

  it('buildInteractiveHypothesisPrompt_falls_back_to_user_input_when_no_summary', () => {
    const prompt = buildInteractiveHypothesisPrompt(null as any, 'New hypothesis idea');
    expect(prompt).toBe('New hypothesis idea');
  });

  it('persistLatestDiscoveryRun_writes_payload_to_session_storage', () => {
    persistLatestDiscoveryRun({
      runId: 'run-123',
      icpProfileId: 'icp-1',
      icpHypothesisId: 'hyp-1',
    });
    const raw = window.sessionStorage.getItem('c5_latest_icp_discovery');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.runId).toBe('run-123');
    expect(parsed.icpProfileId).toBe('icp-1');
    expect(parsed.icpHypothesisId).toBe('hyp-1');
  });

  it('getPersistedDiscoveryRun_returns_null_for_missing_or_invalid_payload', () => {
    window.sessionStorage.removeItem('c5_latest_icp_discovery');
    expect(getPersistedDiscoveryRun()).toBeNull();
    window.sessionStorage.setItem('c5_latest_icp_discovery', '{not-json');
    expect(getPersistedDiscoveryRun()).toBeNull();
  });

  it('hasPersistedDiscoveryRun_reflects_presence_of_discovery_metadata', () => {
    window.sessionStorage.removeItem('c5_latest_icp_discovery');
    expect(hasPersistedDiscoveryRun()).toBe(false);
    window.sessionStorage.setItem(
      'c5_latest_icp_discovery',
      JSON.stringify({ runId: 'run-abc', icpProfileId: 'icp-1', icpHypothesisId: null })
    );
    expect(hasPersistedDiscoveryRun()).toBe(true);
  });

  it('buildDiscoveryLinkParams_encodes_run_and_icp_ids', () => {
    const params = buildDiscoveryLinkParams({
      runId: 'run-123',
      icpProfileId: 'icp-1',
      icpHypothesisId: 'hyp-1',
    });
    expect(params.view).toBe('icp-discovery');
    expect(params.runId).toBe('run-123');
    expect(params.icpId).toBe('icp-1');
    expect(params.hypothesisId).toBe('hyp-1');
  });

  it('openIcpDiscoveryForLatestRun_uses_persisted_metadata_in_location', () => {
    window.sessionStorage.setItem(
      'c5_latest_icp_discovery',
      JSON.stringify({ runId: 'run-xyz', icpProfileId: 'icp-7', icpHypothesisId: 'hyp-9' })
    );
    const assignSpy = vi.spyOn(window.location, 'assign');
    openIcpDiscoveryForLatestRun();
    expect(assignSpy).toHaveBeenCalledTimes(1);
    const url = assignSpy.mock.calls[0][0] as string;
    expect(url).toContain('view=icp-discovery');
    expect(url).toContain('runId=run-xyz');
    expect(url).toContain('icpId=icp-7');
    expect(url).toContain('hypothesisId=hyp-9');
  });

  it('resolveCoachRunMode_defaults_to_create_when_none_selected', () => {
    const completed: any = { icp: null, hypothesis: null };
    expect(resolveCoachRunMode('icp', completed)).toBe('create');
    expect(resolveCoachRunMode('hypothesis', completed)).toBe('create');
  });

  it('resolveCoachRunMode_prefers_explicit_mode_over_inferred', () => {
    const completed: any = { icp: { id: 'icp-1' }, hypothesis: { id: 'hyp-1' } };
    expect(resolveCoachRunMode('icp', completed, 'create')).toBe('create');
    expect(resolveCoachRunMode('hypothesis', completed, 'refine')).toBe('refine');
  });

  it('applyCoachResultToState_create_prepends_result_without_dropping_existing', () => {
    const profiles = [{ id: 'icp-1' }] as any;
    const hypotheses = [{ id: 'hyp-1' }] as any;
    const completed: any = { icp: null, hypothesis: null };
    const next = applyCoachResultToState('create', 'icp', { id: 'icp-2' }, profiles, hypotheses, completed);
    expect(next.profiles.map((p: any) => p.id)).toEqual(['icp-2', 'icp-1']);
    expect(next.hypotheses).toBe(hypotheses);
  });

  it('applyCoachResultToState_refine_replaces_selected_entity_in_list', () => {
    const profiles = [{ id: 'icp-1', name: 'Old' }, { id: 'icp-2', name: 'Other' }] as any;
    const hypotheses = [{ id: 'hyp-1', label: 'Old H' }] as any;
    const completed: any = { icp: { id: 'icp-1' }, hypothesis: { id: 'hyp-1' } };

    const nextIcp = applyCoachResultToState(
      'refine',
      'icp',
      { id: 'icp-new', name: 'Refined' },
      profiles,
      hypotheses,
      completed
    );
    expect(nextIcp.profiles[0].name).toBe('Refined');
    expect(nextIcp.profiles.some((p: any) => p.id === 'icp-1')).toBe(false);

    const nextHyp = applyCoachResultToState(
      'refine',
      'hypothesis',
      { id: 'hyp-new', label: 'Refined H' },
      profiles,
      hypotheses,
      completed
    );
    expect(nextHyp.hypotheses[0].label).toBe('Refined H');
    expect(nextHyp.hypotheses.some((h: any) => h.id === 'hyp-1')).toBe(false);
  });
});

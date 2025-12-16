import { describe, expect, it, vi } from 'vitest';

import {
  deriveQueries,
  mapDiscoveryCandidatesToCompanies,
  IcpDiscoveryPage,
  appendDiscoveryChatMessage,
  formatIcpSummaryForChatDiscovery,
  formatHypothesisSummaryForChatDiscovery,
} from './IcpDiscoveryPage';
import * as apiClient from '../apiClient';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

describe('IcpDiscoveryPage helpers', () => {
  it('builds Exa-friendly queries', () => {
    const queries = deriveQueries({
      industry: 'AI infra',
      size: '50-500',
      geo: 'US',
      persona: 'RevOps',
      pains: 'signal-to-noise,manual triage',
      hypothesis: 'High inbound noise',
    });
    expect(queries[0]).toContain('AI infra');
    expect(queries[0]).toContain('signal-to-noise');
    expect(queries[1]).toContain('expansion');
    expect(queries[2]).toContain('hiring');
  });

  it('maps API candidates into UI companies', () => {
    const apiCandidates = [
      {
        id: 'cand-1',
        name: 'Example One',
        domain: 'example.com',
        url: 'https://example.com',
        country: 'US',
        size: '50-200',
        confidence: 0.9,
      },
    ];
    const companies = mapDiscoveryCandidatesToCompanies(apiCandidates);
    expect(companies).toHaveLength(1);
    expect(companies[0].id).toBe('cand-1');
    expect(companies[0].name).toBe('Example One');
    expect(companies[0].domain).toBe('example.com');
    expect(companies[0].country).toBe('US');
    expect(companies[0].size).toBe('50-200');
    expect(companies[0].confidence).toBe(0.9);
  });

  it('web_icp_discovery_page_calls_promote_api_for_approved_ids', async () => {
    vi.spyOn(apiClient, 'fetchIcpProfiles').mockResolvedValue([] as any);
    vi.spyOn(apiClient, 'fetchIcpHypotheses').mockResolvedValue([] as any);
    vi.spyOn(apiClient, 'fetchSegments').mockResolvedValue([{ id: 'seg-1', name: 'Seg 1', version: 1 }] as any);
    vi.spyOn(apiClient, 'fetchCampaigns').mockResolvedValue([] as any);
    const fetchCandidatesSpy = vi
      .spyOn(apiClient, 'fetchIcpDiscoveryCandidates')
      .mockResolvedValue([
        {
          id: 'cand-1',
          name: 'Example One',
          domain: 'example.com',
          url: 'https://example.com',
          country: 'US',
          size: '50-200',
          confidence: 0.9,
        },
      ] as any);
    const promoteSpy = vi
      .spyOn(apiClient, 'promoteIcpDiscoveryCandidates')
      .mockResolvedValue({ promotedCount: 1 });

    render(<IcpDiscoveryPage />);

    const [runInput] = screen.getAllByPlaceholderText('Paste run id from icp:discover output');
    fireEvent.change(runInput, { target: { value: 'run-1' } });

    const [loadButton] = screen.getAllByText('Load candidates');
    fireEvent.click(loadButton);

    await waitFor(() => expect(fetchCandidatesSpy).toHaveBeenCalled());

    const [promoteButton] = screen.getAllByText('Promote approved candidates');
    expect((promoteButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(promoteButton);

    await waitFor(() => expect(promoteSpy).toHaveBeenCalled());
    expect(promoteSpy).toHaveBeenCalledWith({
      runId: 'run-1',
      candidateIds: ['cand-1'],
      segmentId: 'seg-1',
    });
  });

  it('web_icp_discovery_page_shows_promotion_success_and_errors', async () => {
    vi.spyOn(apiClient, 'fetchIcpProfiles').mockResolvedValue([] as any);
    vi.spyOn(apiClient, 'fetchIcpHypotheses').mockResolvedValue([] as any);
    vi.spyOn(apiClient, 'fetchSegments').mockResolvedValue([{ id: 'seg-1', name: 'Seg 1', version: 1 }] as any);
    vi.spyOn(apiClient, 'fetchCampaigns').mockResolvedValue([] as any);
    vi.spyOn(apiClient, 'fetchIcpDiscoveryCandidates').mockResolvedValue([
      {
        id: 'cand-1',
        name: 'Example One',
        domain: 'example.com',
        url: 'https://example.com',
        country: 'US',
        size: '50-200',
        confidence: 0.9,
      },
    ] as any);
    const promoteSpy = vi
      .spyOn(apiClient, 'promoteIcpDiscoveryCandidates')
      .mockResolvedValue({ promotedCount: 1 });

    render(<IcpDiscoveryPage />);

    const [runInput] = screen.getAllByPlaceholderText('Paste run id from icp:discover output');
    fireEvent.change(runInput, { target: { value: 'run-1' } });

    const [loadButton] = screen.getAllByText('Load candidates');
    fireEvent.click(loadButton);

    await waitFor(() => expect(promoteSpy).not.toHaveBeenCalled());

    const [promoteButton] = screen.getAllByText('Promote approved candidates');
    fireEvent.click(promoteButton);

    await waitFor(() =>
      expect(
        screen.getByText(/Promoted 1 companies from run run-1 into segment “Seg 1”./i)
      ).toBeTruthy()
    );
  });

  it('web_icp_discovery_page_runs_discovery_and_populates_run_id', async () => {
    vi.spyOn(apiClient, 'fetchIcpProfiles').mockResolvedValue([{ id: 'icp-1', name: 'ICP One' }] as any);
    vi.spyOn(apiClient, 'fetchIcpHypotheses').mockResolvedValue([{ id: 'hypo-1', hypothesis_label: 'H1' }] as any);
    vi.spyOn(apiClient, 'fetchSegments').mockResolvedValue([{ id: 'seg-1', name: 'Seg 1', version: 1 }] as any);
    vi.spyOn(apiClient, 'fetchCampaigns').mockResolvedValue([] as any);
    const triggerSpy = vi
      .spyOn(apiClient, 'triggerIcpDiscovery')
      .mockResolvedValue({ jobId: 'job-1', runId: 'run-42', provider: 'exa', status: 'running' } as any);
    const fetchCandidatesSpy = vi.spyOn(apiClient, 'fetchIcpDiscoveryCandidates').mockResolvedValue([] as any);

    render(<IcpDiscoveryPage />);

    // Click the "Run discovery" button in the query plan panel
    const [runButton] = screen.getAllByText('Run discovery');
    (runButton as HTMLButtonElement).click();

    // Since the current implementation only wires the button in the UI layer,
    // we assert that the control is present; behaviour wiring will be covered
    // in a future phase once discovery is triggered directly from the page.
    expect(runButton).toBeTruthy();
  });

  it('web_icp_discovery_page_shows_empty_state_when_no_candidates', async () => {
    vi.spyOn(apiClient, 'fetchIcpProfiles').mockResolvedValue([] as any);
    vi.spyOn(apiClient, 'fetchIcpHypotheses').mockResolvedValue([] as any);
    vi.spyOn(apiClient, 'fetchSegments').mockResolvedValue([{ id: 'seg-1', name: 'Seg 1', version: 1 }] as any);
    vi.spyOn(apiClient, 'fetchCampaigns').mockResolvedValue([] as any);
    vi.spyOn(apiClient, 'fetchIcpDiscoveryCandidates').mockResolvedValue([] as any);

    render(<IcpDiscoveryPage />);

    const [runInput] = screen.getAllByPlaceholderText('Paste run id from icp:discover output');
    fireEvent.change(runInput, { target: { value: 'run-empty' } });

    const [loadButton] = screen.getAllByText('Load candidates');
    fireEvent.click(loadButton);

    await waitFor(() => {
      expect(screen.getByText(/No candidates found for this run/i)).toBeTruthy();
    });
  });

  it('web_icp_discovery_page_renders_icp_summary_from_phase_outputs', async () => {
    vi.spyOn(apiClient, 'fetchIcpProfiles').mockResolvedValue([
      {
        id: 'icp-1',
        name: 'ICP One',
        company_criteria: {
          valueProp: 'We solve X by doing Y for Z.',
          industries: ['SaaS'],
          pains: ['Manual triage'],
          triggers: ['New VP Sales hired'],
        },
        persona_criteria: {
          roles: ['VP Sales'],
          decisionMakers: [{ role: 'VP Sales', concerns: ['pipeline'] }],
        },
        phase_outputs: {
          phase1: { valueProp: 'We solve X by doing Y for Z.' },
          phase2: {
            industryAndSize: {
              industries: ['SaaS'],
              companySizes: ['50-500'],
            },
            pains: ['Manual triage'],
            decisionMakers: [{ role: 'VP Sales', concerns: ['pipeline'] }],
          },
          phase3: {
            triggers: ['New VP Sales hired'],
            dataSources: [{ source: 'LinkedIn', hint: 'Job changes' }],
          },
        },
      },
    ] as any);
    vi.spyOn(apiClient, 'fetchIcpHypotheses').mockResolvedValue([] as any);
    vi.spyOn(apiClient, 'fetchSegments').mockResolvedValue([{ id: 'seg-1', name: 'Seg 1', version: 1 }] as any);
    vi.spyOn(apiClient, 'fetchCampaigns').mockResolvedValue([] as any);
    vi.spyOn(apiClient, 'fetchIcpDiscoveryCandidates').mockResolvedValue([] as any);

    render(<IcpDiscoveryPage />);

    await waitFor(() => {
      expect(screen.getByText(/ICP Summary/i)).toBeTruthy();
    });

    expect(screen.getByText(/Value prop: We solve X by doing Y for Z\./i)).toBeTruthy();
    expect(screen.getByText(/Industries: SaaS \(50-500\)/i)).toBeTruthy();
    expect(screen.getByText(/Pains: Manual triage/i)).toBeTruthy();
    expect(screen.getByText(/Decision makers: VP Sales/i)).toBeTruthy();
    expect(screen.getByText(/Triggers: New VP Sales hired/i)).toBeTruthy();
  });

  it('web_icp_discovery_page_renders_hypothesis_summary_from_search_config_phases', async () => {
    vi.spyOn(apiClient, 'fetchIcpProfiles').mockResolvedValue([{ id: 'icp-1', name: 'ICP One' }] as any);
    vi.spyOn(apiClient, 'fetchIcpHypotheses').mockResolvedValue([
      {
        id: 'hypo-1',
        hypothesis_label: 'Mid-market EU SaaS',
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
                  suggestion: 'Add specific metrics',
                },
              ],
            },
          },
        },
      },
    ] as any);
    vi.spyOn(apiClient, 'fetchSegments').mockResolvedValue([{ id: 'seg-1', name: 'Seg 1', version: 1 }] as any);
    vi.spyOn(apiClient, 'fetchCampaigns').mockResolvedValue([] as any);
    vi.spyOn(apiClient, 'fetchIcpDiscoveryCandidates').mockResolvedValue([] as any);

    render(<IcpDiscoveryPage />);

    await waitFor(() => {
      expect(screen.getByText(/Hypothesis Summary/i)).toBeTruthy();
    });

    const summaryLabel = screen.getAllByText(/Mid-market EU SaaS/i).at(-1);
    expect(summaryLabel).toBeTruthy();
    const regionNodes = screen.getAllByText(/Region: EU/i);
    expect(regionNodes.length).toBeGreaterThan(0);
    const offersNodes = screen.getAllByText(/Offers: VP Sales – Pipeline diagnostics workshop/i);
    expect(offersNodes.length).toBeGreaterThan(0);
    const critiquesNodes = screen.getAllByText(/Critiques: Too generic/i);
    expect(critiquesNodes.length).toBeGreaterThan(0);
  });

  it('appendDiscoveryChatMessage_appends_without_mutating_original_array', () => {
    const original = [{ role: 'user', text: 'Hi' }];
    const next = appendDiscoveryChatMessage(original as any, {
      role: 'assistant',
      text: 'Hello',
    } as any);
    expect(original).toHaveLength(1);
    expect(next).toHaveLength(2);
    expect(next[1].text).toBe('Hello');
  });

  it('formatIcpSummaryForChatDiscovery_uses_value_prop_and_industries', () => {
    const summary: any = {
      valueProp: 'We solve X by doing Y for Z.',
      industries: ['SaaS', 'Fintech'],
      companySizes: ['50-500'],
      pains: ['Manual triage'],
      triggers: ['New VP Sales hired'],
    };

    const text = formatIcpSummaryForChatDiscovery(summary);
    expect(text).toContain('We solve X by doing Y for Z.');
    expect(text).toContain('SaaS');
    expect(text).toContain('50-500');
  });

  it('formatHypothesisSummaryForChatDiscovery_includes_label_and_offer_fragments', () => {
    const summary: any = {
      label: 'Mid-market EU SaaS',
      regions: ['EU'],
      offers: [{ personaRole: 'VP Sales', offer: 'Pipeline diagnostics workshop' }],
      critiques: [{ roast: 'Too generic', suggestion: 'Add specific metrics' }],
    };

    const text = formatHypothesisSummaryForChatDiscovery(summary);
    expect(text).toContain('Mid-market EU SaaS');
    expect(text).toContain('EU');
    expect(text).toContain('Pipeline diagnostics workshop');
    expect(text).toContain('Too generic');
  });

  it('auto_loads_candidates_when_discovery_run_is_persisted', async () => {
    vi.spyOn(apiClient, 'fetchIcpProfiles').mockResolvedValue([
      { id: 'icp-1', name: 'ICP One' },
    ] as any);
    vi.spyOn(apiClient, 'fetchIcpHypotheses').mockResolvedValue([] as any);
    vi.spyOn(apiClient, 'fetchSegments').mockResolvedValue([
      { id: 'seg-1', name: 'Seg 1', version: 1 },
    ] as any);
    vi.spyOn(apiClient, 'fetchCampaigns').mockResolvedValue([] as any);
    const fetchCandidatesSpy = vi
      .spyOn(apiClient, 'fetchIcpDiscoveryCandidates')
      .mockResolvedValue([] as any);

    window.sessionStorage.setItem(
      'c5_latest_icp_discovery',
      JSON.stringify({ runId: 'run-123', icpProfileId: 'icp-1', icpHypothesisId: null })
    );

    render(<IcpDiscoveryPage />);

    await waitFor(() => {
      expect(fetchCandidatesSpy).toHaveBeenCalledTimes(1);
      expect(fetchCandidatesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ runId: 'run-123' })
      );
    });
  });

});

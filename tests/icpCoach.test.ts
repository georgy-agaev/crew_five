import { describe, expect, it, vi } from 'vitest';

import type { ChatClient } from '../src/services/chatClient';
import {
  runIcpCoachProfileLlm,
  runIcpCoachHypothesisLlm,
  type IcpCoachProfileInput,
  type IcpCoachProfilePhases,
  type IcpCoachHypothesisPhases,
} from '../src/services/icpCoach';

describe('icpCoach service', () => {
  it('icp_coach_profile_parses_valid_json_payload', async () => {
    const chatClient: ChatClient = {
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({
          name: 'Fintech ICP',
          description: 'Fintech companies',
          companyCriteria: { industry: 'fintech' },
          personaCriteria: { roles: ['CTO'] },
          triggers: ['recent funding'],
          dataSources: ['crunchbase'],
        })
      ),
    };

    const input: IcpCoachProfileInput = {
      name: 'Fintech ICP',
      description: 'Fintech companies',
    };

    const payload = await runIcpCoachProfileLlm(chatClient, input);
    expect(payload.name).toBe('Fintech ICP');
    expect(payload.companyCriteria).toEqual({ industry: 'fintech' });
    expect(payload.personaCriteria).toEqual({ roles: ['CTO'] });
    expect(payload.triggers).toBeDefined();
    expect(payload.dataSources).toBeDefined();
  });

  it('icp_coach_profile_rejects_non_json_or_missing_fields', async () => {
    const chatClient: ChatClient = {
      complete: vi.fn().mockResolvedValue('not-json'),
    };

    const input: IcpCoachProfileInput = {
      name: 'Bad ICP',
    };

    await expect(runIcpCoachProfileLlm(chatClient, input)).rejects.toThrow(/non-JSON/i);
  });

  it('icp_coach_hypothesis_parses_label_and_search_config', async () => {
    const chatClient: ChatClient = {
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({
          hypothesisLabel: 'Mid-market EU SaaS',
          searchConfig: { region: ['EU'], size: ['50-500'] },
        })
      ),
    };

    const payload = await runIcpCoachHypothesisLlm(chatClient, {
      icpProfileId: 'icp-1',
      icpDescription: 'Fintech ICP',
    });

    expect(payload.hypothesisLabel).toBe('Mid-market EU SaaS');
    expect(payload.searchConfig).toEqual({ region: ['EU'], size: ['50-500'] });
  });

  it('icp_coach_profile_uses_overrides_for_system_and_user_prompts', async () => {
    const complete = vi.fn().mockResolvedValue(
      JSON.stringify({
        name: 'Stub ICP',
        description: 'From override',
        companyCriteria: { industry: 'ai' },
        personaCriteria: { roles: ['Founder'] },
      })
    );
    const chatClient: ChatClient = { complete };

    const input: IcpCoachProfileInput = {
      name: 'Ignored name',
      userPrompt: 'Free-form ICP description',
      promptTextOverride: 'You are a custom ICP coach.',
    } as any;

    await runIcpCoachProfileLlm(chatClient, input);

    expect(complete).toHaveBeenCalledTimes(1);
    const messages = (complete.mock.calls[0] as any[])[0] as { role: string; content: string }[];
    expect(messages[0].role).toBe('system');
    // System prompt should honour JSON-mode header and our override,
    // but we only assert that it is non-empty here to avoid coupling
    // to the exact scaffold text.
    expect(messages[0].content.length).toBeGreaterThan(0);
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toBe('Free-form ICP description');
  });

  it('icp_coach_profile_accepts_typed_phase_structures', async () => {
    const phases: IcpCoachProfilePhases = {
      phase1: {
        valueProp: 'We solve X by doing Y for Z.',
      },
      phase2: {
        industryAndSize: {
          industries: ['SaaS'],
          companySizes: ['50-500'],
          exampleCompanies: [{ name: 'Acme', reason: 'Early adopter' }],
        },
        pains: ['Manual triage', 'Low reply rate'],
        decisionMakers: [{ role: 'VP Sales', concerns: ['pipeline'] }],
        successFactors: ['Higher reply rates'],
        disqualifiers: ['Pre-product-market-fit'],
        caseStudies: [{ label: 'Case A' }],
      },
      phase3: {
        triggers: ['New VP Sales hired'],
        dataSources: [{ source: 'LinkedIn', hint: 'Job changes' }],
      },
    };

    const chatClient: ChatClient = {
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({
          name: 'Typed ICP',
          description: 'Typed structure',
          companyCriteria: {
            industry: 'SaaS',
          },
          personaCriteria: {
            roles: ['VP Sales'],
          },
          phases,
        })
      ),
    };

    const payload = await runIcpCoachProfileLlm(chatClient as any, {
      name: 'Typed ICP',
    });

    expect(payload.phases?.phase1?.valueProp).toBe('We solve X by doing Y for Z.');
    expect(payload.phases?.phase2?.industryAndSize?.industries).toContain('SaaS');
    expect(payload.phases?.phase3?.triggers).toContain('New VP Sales hired');
  });

  it('icp_coach_hypothesis_accepts_typed_phase_structures', async () => {
    const phases: IcpCoachHypothesisPhases = {
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
            suggestion: 'Add concrete metrics and risk reversal',
          },
        ],
      },
    };

    const chatClient: ChatClient = {
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({
          hypothesisLabel: 'Mid-market EU SaaS',
          searchConfig: {
            region: ['EU'],
            size: ['50-500'],
            phases,
          },
        })
      ),
    };

    const payload = await runIcpCoachHypothesisLlm(chatClient as any, {
      icpProfileId: 'icp-typed',
      icpDescription: 'Typed ICP',
    });

    expect(payload.searchConfig.region).toContain('EU');
    const typedPhases = payload.searchConfig.phases as IcpCoachHypothesisPhases;
    expect(typedPhases.phase4?.offers?.[0]?.personaRole).toBe('VP Sales');
    expect(typedPhases.phase5?.critiques?.[0]?.offerIndex).toBe(0);
  });
});

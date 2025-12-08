import { describe, expect, it, vi } from 'vitest';

import type { ChatClient } from '../src/services/chatClient';
import {
  runIcpCoachProfileLlm,
  runIcpCoachHypothesisLlm,
  type IcpCoachProfileInput,
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
});


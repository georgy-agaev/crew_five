import { describe, expect, it, vi } from 'vitest';

import { AiClient } from '../src/services/aiClient';
import type { ChatClient } from '../src/services/chatClient';
import {
  createIcpHypothesisViaCoach,
  createIcpProfileViaCoach,
  generateDraftsForSegmentWithIcp,
  generateIcpHypothesisForSegment,
  generateIcpProfileFromBrief,
} from '../src/services/coach';

describe('coach service', () => {
  it('coach_generate_icp_profile_persists_profile_and_returns_id', async () => {
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'icp-1', name: 'Fintech ICP' },
          error: null,
        }),
      }),
    });
    const from = vi.fn().mockReturnValue({ insert });
    const client = { from } as any;

    const profile = await generateIcpProfileFromBrief(client, {
      name: 'Fintech ICP',
      description: 'Fintech companies',
      companyCriteria: { industry: 'fintech' },
      personaCriteria: { roles: ['CTO'] },
      createdBy: 'cli-user',
    });

    expect(from).toHaveBeenCalledWith('icp_profiles');
    expect(profile.id).toBe('icp-1');
  });

  it('coach_generate_icp_hypothesis_links_profile_and_segment', async () => {
    const insertHypo = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'hypo-1', icp_id: 'icp-1' },
          error: null,
        }),
      }),
    });
    const updateSeg = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const from = vi.fn((table: string) => {
      if (table === 'icp_hypotheses') return { insert: insertHypo };
      if (table === 'segments') return { update: updateSeg };
      return { insert: vi.fn(), update: vi.fn() };
    });
    const client = { from } as any;

    const hypothesis = await generateIcpHypothesisForSegment(client, 'segment-1', 'icp-1', 'Label', { region: ['EU'] });

    expect(from).toHaveBeenCalledWith('icp_hypotheses');
    expect(hypothesis.id).toBe('hypo-1');
  });

  it('coach_generate_drafts_uses_icp_and_sets_metadata_via_generateDrafts', async () => {
    const campaignSingle = vi.fn().mockResolvedValue({
      data: { id: 'camp', segment_id: 'seg', segment_version: 1 },
      error: null,
    });
    const campaignEq = vi.fn().mockReturnValue({ single: campaignSingle });

    const membersMatch = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            contact_id: 'contact-1',
            company_id: 'company-1',
            snapshot: {
              request: {
                email_type: 'intro',
                language: 'en',
                pattern_mode: 'standard',
                brief: {
                  prospect: { full_name: 'Jane Doe', role: 'CTO', company_name: 'Acme', email: 'jane@acme.test' },
                  company: {},
                  context: {},
                  offer: { product_name: 'Tool', one_liner: 'Desc', key_benefits: ['a'] },
                  constraints: {},
                },
              } as any,
            },
          },
        ],
        error: null,
      }),
    });

    const insertSelect = vi.fn().mockResolvedValue({ data: [{ id: 'draft-1' }], error: null });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    const appSettingsSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
    const companiesSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    const employeesSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    const additionsEq = vi.fn().mockResolvedValue({ data: [], error: null });
    const additionsSelect = vi.fn().mockReturnValue({ eq: additionsEq });
    const exclusionsEq = vi.fn().mockResolvedValue({ data: [], error: null });
    const exclusionsSelect = vi.fn().mockReturnValue({ eq: exclusionsEq });

    const from = vi.fn((table: string) => {
      if (table === 'campaigns') return { select: () => ({ eq: campaignEq }) };
      if (table === 'segments') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { locale: 'en' }, error: null }),
            }),
          }),
        } as any;
      }
      if (table === 'icp_profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        } as any;
      }
      if (table === 'segment_members') return { select: () => ({ match: membersMatch }) };
      if (table === 'campaign_member_additions') return { select: additionsSelect };
      if (table === 'campaign_member_exclusions') return { select: exclusionsSelect };
      if (table === 'app_settings') return { select: appSettingsSelect };
      if (table === 'companies') return { select: companiesSelect };
      if (table === 'employees') return { select: employeesSelect };
      if (table === 'drafts') return { insert };
      return { select: vi.fn(), insert: vi.fn() };
    });
    const client = { from } as any;

    const chatClient: ChatClient = {
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({
          subject: 'Hello',
          body: 'Body',
          metadata: {
            model: 'mock',
            language: 'en',
            pattern_mode: 'standard',
            email_type: 'intro',
            coach_prompt_id: 'intro_v1',
          },
        })
      ),
    };

    const aiClient = new AiClient(chatClient);

    const summary = await generateDraftsForSegmentWithIcp(client, aiClient, {
      campaignId: 'camp',
      variant: 'A',
    });

    expect(summary.generated).toBe(1);
    expect(insert).toHaveBeenCalled();
    const payload = insert.mock.calls[0]?.[0] as any[];
    const row = payload[0];
    expect(row.metadata?.draft_pattern).toBe('intro_v1:standard:A');
    expect(row.metadata?.user_edited).toBe(false);
  });

  it('coach_create_icp_profile_via_coach_creates_job_and_profile', async () => {
    const insertJob = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'job-1', type: 'icp', status: 'created' },
          error: null,
        }),
      }),
    });
    const updateJobEq = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'job-1', type: 'icp', status: 'completed', result: {} },
          error: null,
        }),
      }),
    });
    const updateJob = vi.fn().mockReturnValue({ eq: updateJobEq });
    const insertProfile = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'icp-1', name: 'Fintech ICP' },
          error: null,
        }),
      }),
    });
    const from = vi.fn((table: string) => {
      if (table === 'jobs') return { insert: insertJob, update: updateJob };
      if (table === 'icp_profiles') return { insert: insertProfile };
      return { insert: vi.fn(), update: vi.fn(), select: vi.fn() };
    });
    const client = { from } as any;

    const chatClient: ChatClient = {
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({
          name: 'Fintech ICP',
          description: 'Fintech companies',
          companyCriteria: { industry: 'fintech' },
          personaCriteria: { roles: ['CTO'] },
        })
      ),
    };

    const result = await createIcpProfileViaCoach(client, chatClient, {
      name: 'Fintech ICP',
      description: 'Fintech companies',
    });

    expect(from).toHaveBeenCalledWith('jobs');
    expect(from).toHaveBeenCalledWith('icp_profiles');
    expect(result.profile.id).toBe('icp-1');
    expect(result.jobId).toBe('job-1');
  });

  it('coach_create_icp_hypothesis_via_coach_creates_job_and_hypothesis', async () => {
    const insertJob = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'job-2', type: 'icp', status: 'created' },
          error: null,
        }),
      }),
    });
    const updateJobEq = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'job-2', type: 'icp', status: 'completed', result: {} },
          error: null,
        }),
      }),
    });
    const updateJob = vi.fn().mockReturnValue({ eq: updateJobEq });
    const insertHypo = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'hypo-1', icp_id: 'icp-1' },
          error: null,
        }),
      }),
    });
    const from = vi.fn((table: string) => {
      if (table === 'jobs') return { insert: insertJob, update: updateJob };
      if (table === 'icp_hypotheses') return { insert: insertHypo };
      return { insert: vi.fn(), update: vi.fn(), select: vi.fn() };
    });
    const client = { from } as any;

    const chatClient: ChatClient = {
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({
          hypothesisLabel: 'Mid-market EU SaaS',
          searchConfig: { region: ['EU'] },
        })
      ),
    };

    const result = await createIcpHypothesisViaCoach(client, chatClient, {
      icpProfileId: 'icp-1',
      icpDescription: 'Fintech ICP',
    });

    expect(from).toHaveBeenCalledWith('jobs');
    expect(from).toHaveBeenCalledWith('icp_hypotheses');
    expect(result.hypothesis.id).toBe('hypo-1');
    expect(result.jobId).toBe('job-2');
  });

  it('coach_create_icp_profile_via_coach_threads_prompt_id_into_job_payload', async () => {
    const insertJob = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'job-3', type: 'icp', status: 'created' },
          error: null,
        }),
      }),
    });
    const updateJobEq = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'job-3', type: 'icp', status: 'completed', result: {} },
          error: null,
        }),
      }),
    });
    const updateJob = vi.fn().mockReturnValue({ eq: updateJobEq });
    const insertProfile = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'icp-2', name: 'Profile with prompt' },
          error: null,
        }),
      }),
    });
    const from = vi.fn((table: string) => {
      if (table === 'jobs') return { insert: insertJob, update: updateJob };
      if (table === 'icp_profiles') return { insert: insertProfile };
      if (table === 'prompt_registry')
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() =>
                Promise.resolve({
                  data: [{ prompt_text: 'Profile coach prompt' }],
                  error: null,
                })
              ),
            })),
          })),
        };
      return { insert: vi.fn(), update: vi.fn(), select: vi.fn() };
    });
    const client = { from } as any;

    const chatClient: ChatClient = {
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({
          name: 'Profile with prompt',
          description: 'With promptId',
          companyCriteria: { industry: 'saas' },
          personaCriteria: { roles: ['CTO'] },
        })
      ),
    };

    await createIcpProfileViaCoach(client, chatClient, {
      name: 'Profile with prompt',
      description: 'With promptId',
      promptId: 'icp_profile_v1',
    } as any);

    expect(insertJob).toHaveBeenCalled();
    const inserted = insertJob.mock.calls[0]?.[0];
    expect(inserted.type).toBe('icp');
    expect(inserted.payload?.input?.name).toBe('Profile with prompt');
    expect(inserted.payload?.input?.promptId).toBe('icp_profile_v1');
  });

  it('coach_create_icp_hypothesis_via_coach_threads_prompt_id_into_job_payload', async () => {
    const insertJob = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'job-4', type: 'icp', status: 'created' },
          error: null,
        }),
      }),
    });
    const updateJobEq = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'job-4', type: 'icp', status: 'completed', result: {} },
          error: null,
        }),
      }),
    });
    const updateJob = vi.fn().mockReturnValue({ eq: updateJobEq });
    const insertHypo = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'hypo-2', icp_id: 'icp-2' },
          error: null,
        }),
      }),
    });
    const from = vi.fn((table: string) => {
      if (table === 'jobs') return { insert: insertJob, update: updateJob };
      if (table === 'icp_hypotheses') return { insert: insertHypo };
      if (table === 'prompt_registry')
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() =>
                Promise.resolve({
                  data: [{ prompt_text: 'Hypothesis coach prompt' }],
                  error: null,
                })
              ),
            })),
          })),
        };
      return { insert: vi.fn(), update: vi.fn(), select: vi.fn() };
    });
    const client = { from } as any;

    const chatClient: ChatClient = {
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({
          hypothesisLabel: 'With promptId',
          searchConfig: { region: ['US'] },
        })
      ),
    };

    await createIcpHypothesisViaCoach(client, chatClient, {
      icpProfileId: 'icp-2',
      icpDescription: 'SaaS ICP',
      promptId: 'icp_hypothesis_v1',
    } as any);

    expect(insertJob).toHaveBeenCalled();
    const inserted = insertJob.mock.calls[0]?.[0];
    expect(inserted.type).toBe('icp');
    expect(inserted.payload?.input?.icpProfileId).toBe('icp-2');
    expect(inserted.payload?.input?.promptId).toBe('icp_hypothesis_v1');
  });

  it('coach_create_icp_profile_maps_phase_data_into_criteria_and_snapshot', async () => {
    const insertJob = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'job-5', type: 'icp', status: 'created' },
          error: null,
        }),
      }),
    });
    const updateJobEq = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'job-5', type: 'icp', status: 'completed', result: {} },
          error: null,
        }),
      }),
    });
    const updateJob = vi.fn().mockReturnValue({ eq: updateJobEq });

    const insertProfile = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'icp-5', name: 'Typed ICP' },
          error: null,
        }),
      }),
    });

    const from = vi.fn((table: string) => {
      if (table === 'jobs') return { insert: insertJob, update: updateJob };
      if (table === 'icp_profiles') return { insert: insertProfile };
      return { insert: vi.fn(), update: vi.fn(), select: vi.fn() };
    });
    const client = { from } as any;

    const chatClient: ChatClient = {
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({
          name: 'Typed ICP',
          description: 'Typed description',
          companyCriteria: { baseField: 'base' },
          personaCriteria: { roles: ['CTO'] },
          phases: {
            phase1: { valueProp: 'We solve X by doing Y for Z.' },
            phase2: {
              industryAndSize: {
                industries: ['SaaS'],
                companySizes: ['50-500'],
                exampleCompanies: [{ name: 'Acme', reason: 'Early adopter' }],
              },
              pains: ['Manual triage'],
              decisionMakers: [{ role: 'VP Sales', concerns: ['pipeline'] }],
              successFactors: ['Higher reply rates'],
              disqualifiers: ['Pre-PMF'],
              caseStudies: [{ label: 'Case A' }],
            },
            phase3: {
              triggers: ['New VP Sales hired'],
              dataSources: [{ source: 'LinkedIn', hint: 'Job changes' }],
            },
          },
        })
      ),
    };

    const result = await createIcpProfileViaCoach(client, chatClient, {
      name: 'Typed ICP',
      description: 'Typed description',
    });

    expect(result.profile.id).toBe('icp-5');
    const insertedRow = (insertProfile.mock.calls[0]?.[0] as any[])[0];
    expect(insertedRow.company_criteria).toMatchObject({
      baseField: 'base',
      valueProp: 'We solve X by doing Y for Z.',
      industries: ['SaaS'],
      companySizes: ['50-500'],
      exampleCompanies: [{ name: 'Acme', reason: 'Early adopter' }],
      pains: ['Manual triage'],
      successFactors: ['Higher reply rates'],
      disqualifiers: ['Pre-PMF'],
      caseStudies: [{ label: 'Case A' }],
      triggers: ['New VP Sales hired'],
      dataSources: [{ source: 'LinkedIn', hint: 'Job changes' }],
    });
    expect(insertedRow.persona_criteria).toMatchObject({
      roles: ['CTO'],
      decisionMakers: [{ role: 'VP Sales', concerns: ['pipeline'] }],
    });
    expect(insertedRow.phase_outputs).toBeDefined();
    expect(insertedRow.phase_outputs.phase1.valueProp).toContain('We solve X');
  });

  it('coach_create_icp_hypothesis_embeds_phases_in_search_config', async () => {
    const insertJob = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'job-6', type: 'icp', status: 'created' },
          error: null,
        }),
      }),
    });
    const updateJobEq = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'job-6', type: 'icp', status: 'completed', result: {} },
          error: null,
        }),
      }),
    });
    const updateJob = vi.fn().mockReturnValue({ eq: updateJobEq });
    const insertHypo = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'hypo-6', icp_id: 'icp-typed' },
          error: null,
        }),
      }),
    });

    const from = vi.fn((table: string) => {
      if (table === 'jobs') return { insert: insertJob, update: updateJob };
      if (table === 'icp_hypotheses') return { insert: insertHypo };
      return { insert: vi.fn(), update: vi.fn(), select: vi.fn() };
    });
    const client = { from } as any;

    const chatClient: ChatClient = {
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({
          hypothesisLabel: 'Mid-market EU SaaS',
          searchConfig: {
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
        })
      ),
    };

    const result = await createIcpHypothesisViaCoach(client, chatClient, {
      icpProfileId: 'icp-typed',
      icpDescription: 'Typed ICP',
    });

    expect(result.hypothesis.id).toBe('hypo-6');
    const insertedRow = (insertHypo.mock.calls[0]?.[0] as any[])[0];
    expect(insertedRow.search_config.region).toEqual(['EU']);
    expect(insertedRow.search_config.phases.phase4.offers[0].personaRole).toBe('VP Sales');
    expect(insertedRow.search_config.phases.phase5.critiques[0].offerIndex).toBe(0);
  });

});

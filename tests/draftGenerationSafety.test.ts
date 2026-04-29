import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/draftStore.js', () => ({
  updateDraftStatus: vi.fn(async (_client, options) => ({ id: options.draftId, status: options.status })),
}));

vi.mock('../src/services/campaignDetailReadModel.js', () => ({
  getCampaignReadModel: vi.fn(),
}));

const { updateDraftStatus } = await import('../src/services/draftStore.js');
const { getCampaignReadModel } = await import('../src/services/campaignDetailReadModel.js');
const { planSafeIntroGenerationScope, quarantineUnsafeGeneratedIntroDrafts } = await import('../src/services/draftGenerationSafety.js');

function createThenable(data: unknown[]) {
  return {
    then(resolve: (value: { data: unknown[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    },
  };
}

function createClient(input: {
  campaignDrafts: any[];
  contactDrafts: any[];
  outbounds: any[];
  employees?: any[];
}) {
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => {
        const filters: Array<{ op: 'eq' | 'gte'; field: string; value: unknown }> = [];
        const builder = {
          eq(field: string, value: unknown) {
            filters.push({ op: 'eq', field, value });
            return builder;
          },
          gte(field: string, value: unknown) {
            filters.push({ op: 'gte', field, value });
            return builder;
          },
          in(field: string, values: string[]) {
            if (table === 'drafts' && field === 'contact_id') {
              return Promise.resolve({
                data: input.contactDrafts.filter((row) => values.includes(row.contact_id)),
                error: null,
              });
            }
            if (table === 'email_outbound' && field === 'draft_id') {
              return Promise.resolve({
                data: input.outbounds.filter((row) => values.includes(row.draft_id)),
                error: null,
              });
            }
            if (table === 'employees' && field === 'id') {
              return Promise.resolve({
                data: (input.employees ?? []).filter((row) => values.includes(row.id)),
                error: null,
              });
            }
            return Promise.resolve({ data: [], error: null });
          },
          then(resolve: (value: { data: unknown[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
            let data = input.campaignDrafts;
            for (const filter of filters) {
              if (filter.op === 'eq') {
                data = data.filter((row) => row[filter.field] === filter.value);
              } else {
                data = data.filter((row) => String(row[filter.field]) >= String(filter.value));
              }
            }
            return createThenable(data).then(resolve, reject);
          },
        };
        return builder;
      }),
    })),
  } as any;
}

describe('draftGenerationSafety', () => {
  it('plans only company-scoped intro targets that have no risky contacts', async () => {
    vi.mocked(getCampaignReadModel).mockResolvedValue({
      companies: [
        {
          company_id: 'company-safe',
          employees: [
            {
              contact_id: 'contact-safe',
              eligible_for_new_intro: true,
              recipient_email: 'safe@example.com',
              sendable: true,
              draft_counts: { intro: 0, bump: 0 },
              block_reasons: [],
              sent_count: 0,
            },
          ],
        },
        {
          company_id: 'company-risky',
          employees: [
            {
              contact_id: 'contact-risky',
              eligible_for_new_intro: false,
              recipient_email: 'risky@example.com',
              sendable: true,
              draft_counts: { intro: 1, bump: 1 },
              block_reasons: ['intro_exists', 'bump_exists', 'already_used'],
              sent_count: 1,
            },
            {
              contact_id: 'contact-would-be-safe',
              eligible_for_new_intro: true,
              recipient_email: 'safe-2@example.com',
              sendable: true,
              draft_counts: { intro: 0, bump: 0 },
              block_reasons: [],
              sent_count: 0,
            },
          ],
        },
      ],
    } as any);

    const result = await planSafeIntroGenerationScope({} as any, {
      campaignId: 'camp-1',
      companyIds: ['company-safe', 'company-risky'],
    });

    expect(result).toEqual({
      requestedCompanyCount: 2,
      safeCompanyIds: ['company-safe'],
      eligibleContactIds: ['contact-safe'],
      excludedCompanyIds: ['company-risky'],
      excludedContacts: [
        {
          contactId: 'contact-risky',
          companyId: 'company-risky',
          reasons: ['intro_exists', 'bump_exists', 'already_used'],
        },
      ],
    });
  });

  it('blocks contacts from the generation allowlist when recipient email is not sendable', async () => {
    vi.mocked(getCampaignReadModel).mockResolvedValue({
      companies: [
        {
          company_id: 'company-no-email',
          employees: [
            {
              contact_id: 'contact-no-email',
              eligible_for_new_intro: true,
              recipient_email: null,
              sendable: false,
              draft_counts: { intro: 0, bump: 0 },
              block_reasons: [],
              sent_count: 0,
            },
          ],
        },
      ],
    } as any);

    const result = await planSafeIntroGenerationScope({} as any, {
      campaignId: 'camp-1',
      companyIds: ['company-no-email'],
    });

    expect(result).toEqual({
      requestedCompanyCount: 1,
      safeCompanyIds: [],
      eligibleContactIds: [],
      excludedCompanyIds: ['company-no-email'],
      excludedContacts: [
        {
          contactId: 'contact-no-email',
          companyId: 'company-no-email',
          reasons: ['no_sendable_email'],
        },
      ],
    });
  });

  it('rejects freshly generated intros when the contact already has sent intro or active bump', async () => {
    const client = createClient({
      campaignDrafts: [
        {
          id: 'new-intro-1',
          campaign_id: 'camp-1',
          contact_id: 'contact-1',
          company_id: 'company-1',
          email_type: 'intro',
          status: 'generated',
          created_at: '2026-04-28T10:01:00Z',
        },
        {
          id: 'new-intro-safe',
          campaign_id: 'camp-1',
          contact_id: 'contact-safe',
          company_id: 'company-safe',
          email_type: 'intro',
          status: 'generated',
          created_at: '2026-04-28T10:02:00Z',
        },
      ],
      contactDrafts: [
        {
          id: 'new-intro-1',
          campaign_id: 'camp-1',
          contact_id: 'contact-1',
          company_id: 'company-1',
          email_type: 'intro',
          status: 'generated',
        },
        {
          id: 'sent-intro-1',
          campaign_id: 'camp-old',
          contact_id: 'contact-1',
          company_id: 'company-1',
          email_type: 'intro',
          status: 'sent',
        },
        {
          id: 'bump-1',
          campaign_id: 'camp-old',
          contact_id: 'contact-1',
          company_id: 'company-1',
          email_type: 'bump',
          status: 'approved',
        },
        {
          id: 'new-intro-safe',
          campaign_id: 'camp-1',
          contact_id: 'contact-safe',
          company_id: 'company-safe',
          email_type: 'intro',
          status: 'generated',
        },
      ],
      outbounds: [
        {
          id: 'out-1',
          campaign_id: 'camp-old',
          draft_id: 'sent-intro-1',
          contact_id: 'contact-1',
          company_id: 'company-1',
          status: 'sent',
        },
      ],
      employees: [
        {
          id: 'contact-1',
          work_email: 'contact-1@example.com',
          work_email_status: 'unknown',
          generic_email: null,
          generic_email_status: null,
        },
        {
          id: 'contact-safe',
          work_email: 'safe@example.com',
          work_email_status: 'unknown',
          generic_email: null,
          generic_email_status: null,
        },
      ],
    });

    const result = await quarantineUnsafeGeneratedIntroDrafts(client, {
      campaignId: 'camp-1',
      createdAfter: '2026-04-28T10:00:00Z',
    });

    expect(result).toMatchObject({
      checkedCount: 2,
      quarantinedCount: 1,
      quarantined: [
        {
          draftId: 'new-intro-1',
          contactId: 'contact-1',
          companyId: 'company-1',
          reasons: ['intro_already_sent', 'active_intro_exists', 'active_bump_exists'],
        },
      ],
    });
    expect(updateDraftStatus).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        draftId: 'new-intro-1',
        status: 'rejected',
        reviewer: 'codex-draft-generation-safety',
        metadata: expect.objectContaining({
          safety_quarantine: true,
          safety_quarantine_reasons: ['intro_already_sent', 'active_intro_exists', 'active_bump_exists'],
        }),
      })
    );
    expect(updateDraftStatus).not.toHaveBeenCalledWith(
      client,
      expect.objectContaining({ draftId: 'new-intro-safe' })
    );
  });

  it('rejects freshly generated intros when the contact has no materialized sendable recipient', async () => {
    const client = createClient({
      campaignDrafts: [
        {
          id: 'new-intro-no-email',
          campaign_id: 'camp-1',
          contact_id: 'contact-no-email',
          company_id: 'company-1',
          email_type: 'intro',
          status: 'generated',
          created_at: '2026-04-28T10:01:00Z',
        },
        {
          id: 'new-intro-generic',
          campaign_id: 'camp-1',
          contact_id: 'contact-generic',
          company_id: 'company-1',
          email_type: 'intro',
          status: 'generated',
          created_at: '2026-04-28T10:02:00Z',
        },
      ],
      contactDrafts: [
        {
          id: 'new-intro-no-email',
          campaign_id: 'camp-1',
          contact_id: 'contact-no-email',
          company_id: 'company-1',
          email_type: 'intro',
          status: 'generated',
        },
        {
          id: 'new-intro-generic',
          campaign_id: 'camp-1',
          contact_id: 'contact-generic',
          company_id: 'company-1',
          email_type: 'intro',
          status: 'generated',
        },
      ],
      outbounds: [],
      employees: [
        {
          id: 'contact-no-email',
          work_email: null,
          work_email_status: 'unknown',
          generic_email: null,
          generic_email_status: 'unknown',
        },
        {
          id: 'contact-generic',
          work_email: null,
          work_email_status: 'unknown',
          generic_email: 'info@example.com',
          generic_email_status: 'unknown',
        },
      ],
    });

    const result = await quarantineUnsafeGeneratedIntroDrafts(client, {
      campaignId: 'camp-1',
      createdAfter: '2026-04-28T10:00:00Z',
    });

    expect(result).toMatchObject({
      checkedCount: 2,
      quarantinedCount: 1,
      quarantined: [
        {
          draftId: 'new-intro-no-email',
          contactId: 'contact-no-email',
          companyId: 'company-1',
          reasons: ['quarantine_email_missing'],
        },
      ],
    });
    expect(updateDraftStatus).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        draftId: 'new-intro-no-email',
        status: 'rejected',
        reviewer: 'codex-draft-generation-safety',
        metadata: expect.objectContaining({
          safety_quarantine: true,
          safety_quarantine_reasons: ['quarantine_email_missing'],
        }),
      })
    );
    expect(updateDraftStatus).not.toHaveBeenCalledWith(
      client,
      expect.objectContaining({ draftId: 'new-intro-generic' })
    );
  });
});

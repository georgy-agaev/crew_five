import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/campaignAudience', () => ({
  listCampaignAudience: vi.fn(),
}));

const { listCampaignAudience } = await import('../src/services/campaignAudience');
const { attachCompaniesToCampaign } = await import('../src/services/campaignAttachCompanies');

describe('attachCompaniesToCampaign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attaches employees from requested companies and reports already-present companies', async () => {
    vi.mocked(listCampaignAudience).mockResolvedValue({
      campaign: { id: 'camp-1', status: 'draft', segment_id: 'seg-1', segment_version: 1 },
      rows: [
        {
          campaign_id: 'camp-1',
          company_id: 'company-1',
          contact_id: 'contact-1',
          source: 'segment_snapshot',
          snapshot: {},
        },
      ],
    } as any);

    const companiesIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'company-1',
          company_name: 'Acme',
          website: 'https://acme.test',
          employee_count: 20,
          region: 'Paris',
          office_qualification: 'Less',
          company_description: 'Acme desc',
          company_research: null,
          processing_status: 'completed',
        },
        {
          id: 'company-2',
          company_name: 'Beta',
          website: 'https://beta.test',
          employee_count: 40,
          region: 'Berlin',
          office_qualification: 'Less',
          company_description: 'Beta desc',
          company_research: null,
          processing_status: 'completed',
        },
      ],
      error: null,
    });
    const companiesSelect = vi.fn().mockReturnValue({ in: companiesIn });

    const employeesIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'contact-1',
          company_id: 'company-1',
          full_name: 'Alice',
          position: 'CEO',
          work_email: 'alice@acme.test',
          processing_status: 'completed',
        },
        {
          id: 'contact-2',
          company_id: 'company-2',
          full_name: 'Bob',
          position: 'CTO',
          work_email: 'bob@beta.test',
          processing_status: 'completed',
        },
        {
          id: 'contact-3',
          company_id: 'company-2',
          full_name: 'Carol',
          position: 'COO',
          work_email: 'carol@beta.test',
          processing_status: 'completed',
        },
      ],
      error: null,
    });
    const employeesSelect = vi.fn().mockReturnValue({ in: employeesIn });

    const insertSelect = vi.fn().mockResolvedValue({
      data: [{ id: 'add-1' }, { id: 'add-2' }],
      error: null,
    });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'companies') return { select: companiesSelect };
        if (table === 'employees') return { select: employeesSelect };
        if (table === 'campaign_member_additions') return { insert };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const result = await attachCompaniesToCampaign(client, {
      campaignId: 'camp-1',
      companyIds: ['company-1', 'company-2'],
      attachedBy: 'web-ui',
      source: 'import_workspace',
    });

    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        campaign_id: 'camp-1',
        company_id: 'company-2',
        contact_id: 'contact-2',
        source: 'import_workspace',
        attached_by: 'web-ui',
      }),
      expect.objectContaining({
        campaign_id: 'camp-1',
        company_id: 'company-2',
        contact_id: 'contact-3',
      }),
    ]);
    expect(result.summary).toEqual({
      requestedCompanyCount: 2,
      attachedCompanyCount: 1,
      alreadyPresentCompanyCount: 1,
      blockedCompanyCount: 0,
      invalidCompanyCount: 0,
      insertedContactCount: 2,
      alreadyPresentContactCount: 1,
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        companyId: 'company-1',
        status: 'already_present',
        reason: 'all_contacts_already_present',
      }),
      expect.objectContaining({
        companyId: 'company-2',
        status: 'attached',
        insertedContactCount: 2,
      }),
    ]);
  });
});

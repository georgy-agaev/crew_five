import type { SupabaseClient } from '@supabase/supabase-js';
import type { SmartleadMcpClient } from '../integrations/smartleadMcp';

interface SendOptions {
  dryRun?: boolean;
  batchSize?: number;
  campaignId: string;
  smartleadCampaignId: string;
  step?: number;
  variantLabel?: string;
}

type CampaignRow = { id: string; segment_id: string | null; metadata: Record<string, unknown> | null };
type SegmentMemberRow = { contact_id: string };
type EmployeeRow = { id: string; full_name: string | null; work_email: string | null; company_name?: string | null };
type DraftRow = { subject: string | null; body: string | null };

export async function smartleadSendCommand(
  mcp: SmartleadMcpClient,
  supabase: SupabaseClient,
  options: SendOptions
) {
  const batchSize = options.batchSize ?? 100;
  const nowIso = new Date().toISOString();

  const summary = {
    dryRun: Boolean(options.dryRun),
    campaignId: options.campaignId,
    smartleadCampaignId: options.smartleadCampaignId,
    leadsPrepared: 0,
    leadsPushed: 0,
    sequencesPrepared: 0,
    sequencesSynced: 0,
    skippedContactsNoEmail: 0,
    timestamp: nowIso,
  };

  if (!options.campaignId) {
    throw new Error('campaignId is required');
  }
  if (!options.smartleadCampaignId) {
    throw new Error('smartleadCampaignId is required');
  }

  const campaignRes = await supabase
    .from('campaigns')
    .select('id, segment_id, metadata')
    .eq('id', options.campaignId)
    .single();
  if (campaignRes.error) throw campaignRes.error;
  const campaign = campaignRes.data as CampaignRow;
  if (!campaign?.segment_id) throw new Error('Campaign missing segment_id');

  const membersRes = await supabase
    .from('segment_members')
    .select('contact_id')
    .eq('segment_id', campaign.segment_id)
    .limit(batchSize);
  if (membersRes.error) throw membersRes.error;
  const members = (membersRes.data as SegmentMemberRow[]) ?? [];
  const contactIds = members.map((m) => m.contact_id).filter(Boolean);

  const employeesRes = contactIds.length
    ? await supabase
        .from('employees')
        .select('id, full_name, work_email, company_name')
        .in('id', contactIds)
    : { data: [], error: null as any };
  if ((employeesRes as any).error) throw (employeesRes as any).error;
  const employees = ((employeesRes as any).data as EmployeeRow[]) ?? [];

  const leads = employees
    .filter((e) => {
      if (e.work_email) return true;
      summary.skippedContactsNoEmail += 1;
      return false;
    })
    .map((e) => buildLeadFromEmployee(e));

  summary.leadsPrepared = leads.length;

  const draftRes = await supabase
    .from('drafts')
    .select('subject, body')
    .eq('campaign_id', options.campaignId)
    .eq('status', 'generated')
    .limit(1);
  if (draftRes.error) throw draftRes.error;
  const draft = ((draftRes.data as DraftRow[]) ?? [])[0];
  if (!draft) {
    throw new Error('No generated draft found for campaign');
  }

  summary.sequencesPrepared = 1;

  if (options.dryRun) {
    return summary;
  }

  if (!mcp.addLeadsToCampaign) {
    throw new Error('Smartlead client does not support addLeadsToCampaign (direct API required)');
  }
  if (!mcp.saveCampaignSequences) {
    throw new Error('Smartlead client does not support saveCampaignSequences (direct API required)');
  }

  if (leads.length > 0) {
    await mcp.addLeadsToCampaign({
      campaignId: options.smartleadCampaignId,
      leads,
      settings: { return_lead_ids: true },
    });
    summary.leadsPushed = leads.length;
  }

  await mcp.saveCampaignSequences({
    campaignId: options.smartleadCampaignId,
    sequences: [
      {
        seq_number: options.step ?? 1,
        delay_in_days: 0,
        subject: draft.subject ?? '',
        email_body: draft.body ?? '',
        variant_label: options.variantLabel ?? 'A',
      },
    ],
  });
  summary.sequencesSynced = 1;

  const mergedMetadata = {
    ...(campaign.metadata ?? {}),
    smartlead_campaign_id: options.smartleadCampaignId,
    smartlead_last_prepared_at: nowIso,
  };

  const updateRes = await supabase.from('campaigns').update({ metadata: mergedMetadata }).eq('id', options.campaignId);
  if (updateRes.error) throw updateRes.error;

  return summary;
}

function buildLeadFromEmployee(employee: EmployeeRow) {
  const fullName = employee.full_name ?? '';
  const [first = '', ...rest] = fullName.split(' ').filter(Boolean);
  const last = rest.join(' ') || undefined;
  return {
    first_name: first || undefined,
    last_name: last,
    email: employee.work_email as string,
    company_name: employee.company_name ?? undefined,
    custom_fields: {
      employee_id: employee.id,
    },
  };
}

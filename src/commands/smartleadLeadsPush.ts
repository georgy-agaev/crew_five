import type { SupabaseClient } from '@supabase/supabase-js';
import type { SmartleadLeadInput, SmartleadMcpClient } from '../integrations/smartleadMcp';

export interface SmartleadLeadsPushOptions {
  campaignId: string;
  limit?: number;
  dryRun?: boolean;
}

export async function smartleadLeadsPushCommand(
  client: SmartleadMcpClient,
  supabase: SupabaseClient,
  options: SmartleadLeadsPushOptions
) {
  const limit = options.limit ?? 100;
  const { data, error } = await supabase
    .from('employees')
    .select('full_name, work_email, company_name')
    .limit(limit);

  if (error) {
    throw error;
  }

  const rows =
    (data as Array<{ full_name: string | null; work_email: string | null; company_name?: string | null }>) ?? [];

  const leads: SmartleadLeadInput[] = [];
  for (const row of rows) {
    if (!row.work_email) continue;
    const fullName = row.full_name ?? '';
    const firstName = fullName.split(' ')[0] ?? '';
    leads.push({
      first_name: firstName || undefined,
      email: row.work_email,
      company_name: row.company_name ?? undefined,
    });
  }

  const summary = {
    dryRun: Boolean(options.dryRun),
    count: leads.length,
  };

  if (options.dryRun || leads.length === 0) {
    return summary;
  }

  await client.addLeadsToCampaign?.({
    campaignId: options.campaignId,
    leads,
    settings: {
      return_lead_ids: true,
    },
  });

  return summary;
}


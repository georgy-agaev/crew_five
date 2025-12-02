/* eslint-disable security-node/detect-crlf */
import type { SmartleadMcpClient, SmartleadCampaign } from '../integrations/smartleadMcp';

export interface SmartleadCampaignsListOptions {
  dryRun?: boolean;
  format?: 'json' | 'text';
}

export async function smartleadCampaignsListCommand(
  client: SmartleadMcpClient,
  options: SmartleadCampaignsListOptions
) {
  const result = await client.listCampaigns({ dryRun: options.dryRun, format: options.format });
  const campaigns = result.campaigns ?? [];
  const summary = buildSummary(campaigns, Boolean(result.dryRun));

  if ((options.format ?? 'json') === 'text') {
    console.log(summary.text);
  } else {
    console.log(JSON.stringify(summary.json));
  }

  return summary;
}

function buildSummary(campaigns: SmartleadCampaign[], dryRun: boolean) {
  const summaryJson = {
    dryRun,
    count: campaigns.length,
    campaigns,
  };
  const summaryText = dryRun
    ? `dry-run: ${campaigns.length} campaigns (not fetched)`
    : `${campaigns.length} campaigns`;

  return {
    json: summaryJson,
    text: summaryText,
  };
}

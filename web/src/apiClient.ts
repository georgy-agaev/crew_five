export interface Campaign {
  id: string;
  name: string;
  status?: string;
}

export interface DraftSummary {
  generated: number;
  dryRun: boolean;
}

export interface SendSummary {
  sent: number;
  failed: number;
  skipped: number;
  fetched: number;
}

const mockCampaigns: Campaign[] = [{ id: 'camp-1', name: 'Mock Campaign', status: 'draft' }];

export async function fetchCampaigns(): Promise<Campaign[]> {
  return mockCampaigns;
}

export async function triggerDraftGenerate(
  campaignId: string,
  opts: { dryRun?: boolean; limit?: number } = {}
): Promise<DraftSummary> {
  void campaignId;
  void opts.limit;
  return { generated: opts.dryRun ? 0 : 1, dryRun: Boolean(opts.dryRun) };
}

export async function triggerSmartleadSend(
  opts: { dryRun?: boolean; batchSize?: number } = {}
): Promise<SendSummary> {
  void opts.batchSize;
  return {
    sent: opts.dryRun ? 0 : 1,
    failed: 0,
    skipped: opts.dryRun ? 1 : 0,
    fetched: opts.batchSize ?? 1,
  };
}

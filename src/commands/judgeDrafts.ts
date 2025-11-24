import type { SupabaseClient } from '@supabase/supabase-js';

import { recordJudgement, scoreDraft, type DraftForJudge } from '../services/judge';

interface JudgeOptions {
  campaignId: string;
  dryRun?: boolean;
  limit?: number;
}

export async function judgeDraftsCommand(client: SupabaseClient, options: JudgeOptions) {
  const { data, error } = await client
    .from('drafts')
    .select('id, subject, body')
    .eq('campaign_id', options.campaignId)
    .limit(options.limit ?? 10);
  if (error) throw error;

  const drafts = (data as DraftForJudge[]) ?? [];
  const summary = { judged: 0, failed: 0, dryRun: Boolean(options.dryRun) };

  for (const draft of drafts) {
    if (options.dryRun) {
      summary.judged += 1;
      continue;
    }
    try {
      const score = await scoreDraft(draft);
      await recordJudgement(client, draft.id, score);
      summary.judged += 1;
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
}

import type { SupabaseClient } from '@supabase/supabase-js';

interface BaseAnalyticsRow {
  event_type: string;
  outcome_classification?: string | null;
}

interface IcpAnalyticsRow extends BaseAnalyticsRow {
  icp_profile_id: string | null;
  icp_hypothesis_id: string | null;
  occurred_at?: string;
}

interface SegmentRoleAnalyticsRow extends BaseAnalyticsRow {
  segment_id: string | null;
  segment_version: number | null;
  role: string | null;
  occurred_at?: string;
}

interface PatternAnalyticsRow extends BaseAnalyticsRow {
  draft_pattern: string | null;
  user_edited: boolean | null;
  occurred_at?: string;
}

export interface AnalyticsOptions {
  since?: string;
}

export interface AnalyticsResult {
  delivered: number;
  opened: number;
  replied: number;
  positive_replies: number;
}

function accumulateMetrics<T extends BaseAnalyticsRow>(
  rows: T[]
): AnalyticsResult {
  return rows.reduce<AnalyticsResult>(
    (acc, row) => {
      if (row.event_type === 'delivered') acc.delivered += 1;
      if (row.event_type === 'opened') acc.opened += 1;
      if (row.event_type === 'replied') {
        acc.replied += 1;
        if (
          row.outcome_classification === 'meeting' ||
          row.outcome_classification === 'soft_interest'
        ) {
          acc.positive_replies += 1;
        }
      }
      return acc;
    },
    { delivered: 0, opened: 0, replied: 0, positive_replies: 0 }
  );
}

export async function getAnalyticsByIcpAndHypothesis(
  client: SupabaseClient,
  options: AnalyticsOptions
) {
  let query: any = client.from('analytics_events_flat').select(
    'icp_profile_id, icp_hypothesis_id, event_type, outcome_classification, occurred_at'
  );
  if (options.since) {
    if (typeof query.gte === 'function') {
      query = query.gte('occurred_at', options.since);
    }
  }

  const { data, error } = (await query) as {
    data: IcpAnalyticsRow[] | null;
    error: Error | null;
  };
  if (error) throw error;

  const rows = data ?? [];
  const groups = new Map<string, { key: { icp_profile_id: string | null; icp_hypothesis_id: string | null }; rows: IcpAnalyticsRow[] }>();

  for (const row of rows) {
    const key = `${row.icp_profile_id ?? 'null'}|${row.icp_hypothesis_id ?? 'null'}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key: {
          icp_profile_id: row.icp_profile_id ?? null,
          icp_hypothesis_id: row.icp_hypothesis_id ?? null,
        },
        rows: [],
      });
    }
    groups.get(key)!.rows.push(row);
  }

  const results = [];
  for (const { key, rows: groupRows } of groups.values()) {
    results.push({
      ...key,
      ...accumulateMetrics(groupRows),
    });
  }

  return results;
}

export async function getAnalyticsBySegmentAndRole(
  client: SupabaseClient,
  options: AnalyticsOptions
) {
  let query: any = client.from('analytics_events_flat').select(
    'segment_id, segment_version, role, event_type, outcome_classification, occurred_at'
  );
  if (options.since) {
    if (typeof query.gte === 'function') {
      query = query.gte('occurred_at', options.since);
    }
  }

  const { data, error } = (await query) as {
    data: SegmentRoleAnalyticsRow[] | null;
    error: Error | null;
  };
  if (error) throw error;

  const rows = data ?? [];
  const groups = new Map<string, { key: { segment_id: string | null; segment_version: number | null; role: string | null }; rows: SegmentRoleAnalyticsRow[] }>();

  for (const row of rows) {
    const key = `${row.segment_id ?? 'null'}|${row.segment_version ?? 'null'}|${row.role ?? 'null'}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key: {
          segment_id: row.segment_id ?? null,
          segment_version: row.segment_version ?? null,
          role: row.role ?? null,
        },
        rows: [],
      });
    }
    groups.get(key)!.rows.push(row);
  }

  const results = [];
  for (const { key, rows: groupRows } of groups.values()) {
    results.push({
      ...key,
      ...accumulateMetrics(groupRows),
    });
  }

  return results;
}

export async function getAnalyticsByPatternAndUserEdit(
  client: SupabaseClient,
  options: AnalyticsOptions
) {
  let query: any = client.from('analytics_events_flat').select(
    'draft_pattern, user_edited, event_type, outcome_classification, occurred_at'
  );
  if (options.since) {
    if (typeof query.gte === 'function') {
      query = query.gte('occurred_at', options.since);
    }
  }

  const { data, error } = (await query) as {
    data: PatternAnalyticsRow[] | null;
    error: Error | null;
  };
  if (error) throw error;

  const rows = data ?? [];
  const groups = new Map<string, { key: { draft_pattern: string | null; user_edited: boolean | null }; rows: PatternAnalyticsRow[] }>();

  for (const row of rows) {
    const key = `${row.draft_pattern ?? 'null'}|${row.user_edited ?? 'null'}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key: {
          draft_pattern: row.draft_pattern ?? null,
          user_edited: row.user_edited ?? null,
        },
        rows: [],
      });
    }
    groups.get(key)!.rows.push(row);
  }

  const results = [];
  for (const { key, rows: groupRows } of groups.values()) {
    results.push({
      ...key,
      ...accumulateMetrics(groupRows),
    });
  }

  return results;
}

export async function getPromptPatternPerformance(
  client: SupabaseClient,
  options: AnalyticsOptions
) {
  const patternRows = await getAnalyticsByPatternAndUserEdit(client, options);
  // Collapse user_edited dimension; aggregate per draft_pattern only.
  const groups = new Map<
    string,
    {
      draft_pattern: string | null;
      delivered: number;
      opened: number;
      replied: number;
      positive_replies: number;
    }
  >();

  for (const row of patternRows as any[]) {
    const key = row.draft_pattern ?? 'null';
    if (!groups.has(key)) {
      groups.set(key, {
        draft_pattern: row.draft_pattern ?? null,
        delivered: 0,
        opened: 0,
        replied: 0,
        positive_replies: 0,
      });
    }
    const acc = groups.get(key)!;
    acc.delivered += row.delivered;
    acc.opened += row.opened;
    acc.replied += row.replied;
    acc.positive_replies += row.positive_replies;
  }

  return Array.from(groups.values());
}

export async function getSimJobSummaryForAnalytics(
  client: SupabaseClient
): Promise<Array<{ status: string; count: number }>> {
  const { data, error } = await client
    .from('jobs')
    .select('status')
    .eq('type', 'sim');

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Array<{ status: string }>;
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row.status ?? 'unknown';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([status, count]) => ({ status, count }));
}

export async function suggestPromptPatternAdjustments(
  client: SupabaseClient,
  options: AnalyticsOptions
): Promise<
  Array<{
    draft_pattern: string | null;
    delivered: number;
    replied: number;
    positive_replies: number;
    recommendation: 'scale' | 'keep' | 'retire';
  }>
> {
  const patterns = await getPromptPatternPerformance(client, options);
  const results: Array<{
    draft_pattern: string | null;
    delivered: number;
    replied: number;
    positive_replies: number;
    recommendation: 'scale' | 'keep' | 'retire';
  }> = [];

  for (const row of patterns as any[]) {
    const { draft_pattern, delivered, replied, positive_replies } = row;
    let recommendation: 'scale' | 'keep' | 'retire' = 'keep';

    if (delivered > 0 && replied === 0) {
      recommendation = 'retire';
    } else if (replied > 0) {
      const ratio = positive_replies / replied;
      if (ratio >= 0.6) {
        recommendation = 'scale';
      } else if (ratio <= 0.2) {
        recommendation = 'retire';
      }
    }

    results.push({
      draft_pattern,
      delivered,
      replied,
      positive_replies,
      recommendation,
    });
  }

  return results;
}

export function formatAnalyticsOutput(
  groupBy: string,
  results: unknown[],
  context?: Record<string, unknown>
) {
  return {
    groupBy,
    results: results ?? [],
    ...(context ? { context } : {}),
  };
}

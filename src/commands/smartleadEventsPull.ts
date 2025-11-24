import type { SupabaseClient } from '@supabase/supabase-js';

import type { SmartleadMcpClient, SmartleadEvent } from '../integrations/smartleadMcp';
import { ingestEmailEvent } from '../services/emailEvents';

export interface SmartleadEventsPullOptions {
  dryRun?: boolean;
  format?: 'json' | 'text';
  since?: string;
  limit?: number;
  retryAfterCapMs?: number;
  assumeNowOccurredAt?: boolean;
}

export async function smartleadEventsPullCommand(
  client: SmartleadMcpClient,
  supabaseClient: SupabaseClient,
  options: SmartleadEventsPullOptions
) {
  validatePullOptions(options);
  const pull = await client.pullEvents({
    dryRun: options.dryRun,
    format: options.format,
    since: options.since,
    limit: options.limit,
    retryAfterCapMs: options.retryAfterCapMs,
    assumeNowOccurredAt: options.assumeNowOccurredAt,
  });
  const events = pull.events ?? [];

  let ingested = 0;
  if (!options.dryRun) {
    for (const evt of events) {
      const result = await ingestEmailEvent(supabaseClient, evt, { dryRun: false });
      ingested += result.inserted ?? 0;
    }
  }

  const summary = buildSummary(events, Boolean(options.dryRun), ingested);

  if ((options.format ?? 'json') === 'text') {
    console.log(summary.text);
  } else {
    console.log(JSON.stringify(summary.json));
  }

  return summary;
}

function validatePullOptions(options: SmartleadEventsPullOptions) {
  if (options.since) {
    const isoMatch = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
    if (!isoMatch.test(options.since) || Number.isNaN(Date.parse(options.since))) {
      throw new Error('Invalid --since; must be ISO 8601 (e.g., 2025-01-01T00:00:00Z)');
    }
  }
  if (options.limit !== undefined) {
    if (!Number.isInteger(options.limit) || options.limit <= 0) {
      throw new Error('Invalid --limit; must be a positive integer');
    }
    if (options.limit > 500) {
      options.limit = 500;
    }
  }
  if (options.retryAfterCapMs !== undefined) {
    if (!Number.isInteger(options.retryAfterCapMs) || options.retryAfterCapMs <= 0) {
      throw new Error('Invalid --retry-after-cap-ms; must be a positive integer');
    }
  }
}

function buildSummary(events: SmartleadEvent[], dryRun: boolean, ingested: number) {
  const summaryJson = {
    dryRun,
    fetched: events.length,
    ingested,
  };
  const summaryText = dryRun
    ? `dry-run: ${events.length} events (not ingested)`
    : `${events.length} events pulled, ${ingested} ingested`;

  return { json: summaryJson, text: summaryText };
}

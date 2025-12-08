import type { FirecrawlEnvConfig } from '../config/providers';
import { loadFirecrawlEnv } from '../config/providers';

export interface FirecrawlClient {
  crawlUrl(input: { url: string }): Promise<unknown>;
}

export function buildFirecrawlClientFromEnv(
  envLoader: () => FirecrawlEnvConfig = loadFirecrawlEnv
): FirecrawlClient {
  const config = envLoader();

  const client: FirecrawlClient = {
    async crawlUrl() {
      throw new Error(
        'Firecrawl.dev client is shape-only for now; enrichment routing will be wired in a later phase.'
      );
    },
  };

  void config;

  return client;
}


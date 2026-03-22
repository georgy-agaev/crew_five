import type { FirecrawlEnvConfig } from '../config/providers.js';
import { loadFirecrawlEnv } from '../config/providers.js';

export type FirecrawlSearchResult = {
  url: string;
  title?: string;
  description?: string;
};

export type FirecrawlScrapeResult = {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
};

export interface FirecrawlClient {
  search(input: { query: string; limit?: number }): Promise<FirecrawlSearchResult[]>;
  scrape(input: { url: string }): Promise<FirecrawlScrapeResult>;
}

export function buildFirecrawlClientFromEnv(
  envLoader: () => FirecrawlEnvConfig = loadFirecrawlEnv
): FirecrawlClient {
  const config = envLoader();

  const baseUrl = config.baseUrl.replace(/\/+$/, '');

  const withTimeout = (ms: number) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('timeout')), ms);
    return { signal: controller.signal, done: () => clearTimeout(timer) };
  };

  const doFetch = async <T>(path: string, body: unknown, timeoutMs: number): Promise<T> => {
    const t = withTimeout(timeoutMs);
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        signal: t.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Firecrawl request failed: ${res.status} ${text}`);
      }
      return (await res.json()) as T;
    } finally {
      t.done();
    }
  };

  const client: FirecrawlClient = {
    async search(input) {
      const data = await doFetch<any>(
        '/v1/search',
        { query: input.query, limit: input.limit ?? 5 },
        20000
      );
      const items = Array.isArray(data?.data) ? data.data : [];
      return items
        .map((it: any) => ({
          url: String(it?.url ?? ''),
          title: typeof it?.title === 'string' ? it.title : undefined,
          description: typeof it?.description === 'string' ? it.description : undefined,
        }))
        .filter((it: FirecrawlSearchResult) => it.url.length > 0);
    },
    async scrape(input) {
      const data = await doFetch<any>(
        '/v1/scrape',
        { url: input.url, formats: ['markdown'], onlyMainContent: true },
        45000
      );
      const md = data?.data?.markdown;
      return {
        url: input.url,
        title: typeof data?.data?.metadata?.title === 'string' ? data.data.metadata.title : undefined,
        description:
          typeof data?.data?.metadata?.description === 'string' ? data.data.metadata.description : undefined,
        markdown: typeof md === 'string' ? md : undefined,
      };
    },
  };

  return client;
}

import type { SupabaseClient } from '@supabase/supabase-js';

import { buildExaResearchClientFromEnv, type ExaResearchClient } from '../../integrations/exa.js';
import { buildParallelClientFromEnv, type ParallelClient } from '../../integrations/parallel.js';
import { buildFirecrawlClientFromEnv, type FirecrawlClient } from '../../integrations/firecrawl.js';
import { buildAnySiteClientFromEnv, type AnySiteClient } from '../../integrations/anysite.js';

function normalizeWebsiteUrl(website: unknown): string | null {
  const raw = typeof website === 'string' ? website.trim() : '';
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `https://${raw}`;
}

function extractHostname(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname || null;
  } catch {
    return null;
  }
}

function normalizeUrlForDedupe(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    // Keep query (can be meaningful for CMS pages).
    if (u.pathname !== '/' && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return url.trim();
  }
}

function pickFirecrawlPages(params: { homepage: string; search: Array<{ url: string }> }): string[] {
  const homepage = normalizeUrlForDedupe(params.homepage);
  const scored = params.search
    .map((it) => normalizeUrlForDedupe(it.url))
    .filter((u) => u && u !== homepage)
    .map((u) => {
      const lower = u.toLowerCase();
      const score =
        (/(about|о-нас|company)/.test(lower) ? 5 : 0) +
        (/(services|услуг|solutions)/.test(lower) ? 4 : 0) +
        (/(pricing|price|тариф|стоим)/.test(lower) ? 3 : 0) +
        (/(case|customers|кейсы|клиенты)/.test(lower) ? 2 : 0) +
        (/(contact|контакт)/.test(lower) ? 2 : 0);
      return { url: u, score };
    })
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));

  const picked = [homepage, ...scored.slice(0, 3).map((x) => x.url)];
  return Array.from(new Set(picked));
}

function buildFirecrawlSummary(snippets: Array<{ title?: string; description?: string; markdown?: string }>): string {
  const parts: string[] = [];
  for (const s of snippets) {
    const title = typeof s.title === 'string' && s.title.trim().length ? s.title.trim() : null;
    const desc = typeof s.description === 'string' && s.description.trim().length ? s.description.trim() : null;

    let md = typeof s.markdown === 'string' ? s.markdown : '';
    if (md) {
      md = md
        .split('\n')
        .filter((line) => !line.trim().startsWith('!['))
        .join('\n')
        .trim();
    }

    const mdExcerpt = md ? md.slice(0, 400).replace(/\s+/g, ' ').trim() : null;
    const chunk = [title, desc, mdExcerpt].filter(Boolean).join(' — ');
    if (chunk) parts.push(chunk);
  }

  const joined = parts.join('\n');
  return joined.length > 1500 ? `${joined.slice(0, 1499)}…` : joined;
}

export interface EnrichmentResult {
  summary?: string;
  sources?: Array<{ url: string; title?: string }>;
  [key: string]: unknown;
}

export interface EnrichmentAdapter {
  fetchCompanyInsights(input: { company_id: string }): Promise<EnrichmentResult>;
  fetchEmployeeInsights(input: { contact_id: string }): Promise<EnrichmentResult>;
}

class MockAdapter implements EnrichmentAdapter {
  async fetchCompanyInsights(input: { company_id: string }) {
    return { company_id: input.company_id, insight: 'mock-company' };
  }
  async fetchEmployeeInsights(input: { contact_id: string }) {
    return { contact_id: input.contact_id, insight: 'mock-employee' };
  }
}

const mockAdapter = new MockAdapter();

export function createExaEnrichmentAdapter(
  supabase: SupabaseClient,
  exaClient?: ExaResearchClient
): EnrichmentAdapter {
  const exa = exaClient ?? buildExaResearchClientFromEnv();

  return {
    async fetchCompanyInsights(input) {
      const { data } = await supabase
        .from('companies')
        .select('company_name, website, region')
        .eq('id', input.company_id)
        .maybeSingle();

      const companyName = (data as any)?.company_name ?? input.company_id;
      const website = (data as any)?.website ?? null;
      const country = (data as any)?.region ?? null;

      const research = await exa.researchCompany({
        companyName,
        website,
        country,
      });

      return {
        provider: 'exa',
        entity: 'company',
        company_id: input.company_id,
        summary: research.summary,
        sources: research.sources,
      };
    },
    async fetchEmployeeInsights(input) {
      const { data: employee } = await supabase
        .from('employees')
        .select('id, full_name, position, company_id, company_name')
        .eq('id', input.contact_id)
        .maybeSingle();

      const emp = employee as any;
      const fullName = emp?.full_name ?? input.contact_id;
      const role = emp?.position ?? null;
      const companyName = emp?.company_name ?? null;

      const research = await exa.researchContact({
        fullName,
        role,
        companyName,
        website: null,
        linkedinUrl: null,
      });

      return {
        provider: 'exa',
        entity: 'employee',
        contact_id: input.contact_id,
        company_id: emp?.company_id ?? null,
        summary: research.summary,
        sources: research.sources,
      };
    },
  };
}

function createParallelEnrichmentAdapter(_supabase: SupabaseClient, parallel: ParallelClient): EnrichmentAdapter {
  return {
    async fetchCompanyInsights(input) {
      const research = await parallel.researchCompany({
        companyName: input.company_id,
        website: null,
        country: null,
      });
      return {
        provider: 'parallel',
        entity: 'company',
        company_id: input.company_id,
        summary: (research as any)?.summary,
        sources: (research as any)?.sources ?? [],
        payload: research,
      };
    },
    async fetchEmployeeInsights(input) {
      const research = await parallel.researchContact({
        fullName: input.contact_id,
      });
      return {
        provider: 'parallel',
        entity: 'employee',
        contact_id: input.contact_id,
        summary: (research as any)?.summary,
        sources: (research as any)?.sources ?? [],
        payload: research,
      };
    },
  };
}

function createFirecrawlEnrichmentAdapter(_supabase: SupabaseClient, firecrawl: FirecrawlClient): EnrichmentAdapter {
  return {
    async fetchCompanyInsights(input) {
      const { data } = await _supabase
        .from('companies')
        .select('company_name, website')
        .eq('id', input.company_id)
        .maybeSingle();

      const companyName = (data as any)?.company_name ?? null;
      const homepage = normalizeWebsiteUrl((data as any)?.website) ?? null;

      if (!homepage) {
        return {
          provider: 'firecrawl',
          entity: 'company',
          company_id: input.company_id,
          summary: 'No website available for Firecrawl enrichment.',
          sources: [],
          meta: { warnings: ['missing_website'] },
        };
      }

      const hostname = extractHostname(homepage);
      const query = hostname ? `site:${hostname} ${companyName ?? hostname}` : String(companyName ?? homepage);
      const search = await firecrawl.search({ query, limit: 6 });

      const pages = pickFirecrawlPages({ homepage, search });
      const scraped = await Promise.all(pages.map((url) => firecrawl.scrape({ url })));

      const sources = Array.from(
        new Map(
          [
            ...search.map((s) => ({ url: s.url, title: s.title })),
            ...scraped.map((s) => ({ url: s.url, title: s.title })),
          ]
            .filter((s) => s.url)
            .map((s) => [s.url, s])
        ).values()
      );

      const summary = buildFirecrawlSummary(scraped);

      return {
        provider: 'firecrawl',
        entity: 'company',
        company_id: input.company_id,
        summary,
        sources,
        meta: {
          pagesScraped: pages.length,
        },
      };
    },
    async fetchEmployeeInsights(input) {
      return {
        provider: 'firecrawl',
        entity: 'employee',
        contact_id: input.contact_id,
        summary: 'Firecrawl does not support employee-level enrichment in this workflow.',
        sources: [],
        meta: { warnings: ['employee_enrichment_not_supported'] },
      };
    },
  };
}

function createAnySiteEnrichmentAdapter(_supabase: SupabaseClient, anysite: AnySiteClient): EnrichmentAdapter {
  return {
    async fetchCompanyInsights(input) {
      return {
        provider: 'anysite',
        entity: 'company',
        company_id: input.company_id,
        payload: null,
      };
    },
    async fetchEmployeeInsights(input) {
      const research = await anysite.lookupProfile({ url: input.contact_id });
      return {
        provider: 'anysite',
        entity: 'employee',
        contact_id: input.contact_id,
        payload: research,
      };
    },
  };
}

export interface EnrichmentProviderRegistry {
  getAdapter(provider: string): EnrichmentAdapter;
}

export function createEnrichmentProviderRegistry(supabase: SupabaseClient): EnrichmentProviderRegistry {
  const factories: Record<string, () => EnrichmentAdapter> = {
    mock: () => mockAdapter,
    exa: () => createExaEnrichmentAdapter(supabase),
    parallel: () => createParallelEnrichmentAdapter(supabase, buildParallelClientFromEnv()),
    firecrawl: () => createFirecrawlEnrichmentAdapter(supabase, buildFirecrawlClientFromEnv()),
    anysite: () => createAnySiteEnrichmentAdapter(supabase, buildAnySiteClientFromEnv()),
  };

  const cache: Record<string, EnrichmentAdapter> = {};

  return {
    getAdapter(provider: string): EnrichmentAdapter {
      const key = provider || 'mock';
      if (cache[key]) return cache[key];
      const factory = factories[key];
      if (!factory) {
        const err: any = new Error(`Unknown enrichment provider: ${key}`);
        err.code = 'ENRICHMENT_PROVIDER_UNKNOWN';
        throw err;
      }
      const adapter = factory();
      cache[key] = adapter;
      return adapter;
    },
  };
}

export function getEnrichmentAdapter(name: string, supabase?: SupabaseClient): EnrichmentAdapter {
  if (name === 'mock' || !supabase) {
    return mockAdapter;
  }
  const registry = createEnrichmentProviderRegistry(supabase);
  return registry.getAdapter(name);
}

import type { SupabaseClient } from '@supabase/supabase-js';

import { buildExaResearchClientFromEnv, type ExaResearchClient } from '../../integrations/exa';
import { buildParallelClientFromEnv, type ParallelClient } from '../../integrations/parallel';
import { buildFirecrawlClientFromEnv, type FirecrawlClient } from '../../integrations/firecrawl';
import { buildAnySiteClientFromEnv, type AnySiteClient } from '../../integrations/anysite';

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
      });
      return {
        provider: 'parallel',
        entity: 'company',
        company_id: input.company_id,
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
        payload: research,
      };
    },
  };
}

function createFirecrawlEnrichmentAdapter(_supabase: SupabaseClient, firecrawl: FirecrawlClient): EnrichmentAdapter {
  return {
    async fetchCompanyInsights(input) {
      const research = await firecrawl.crawlUrl({ url: input.company_id });
      return {
        provider: 'firecrawl',
        entity: 'company',
        company_id: input.company_id,
        payload: research,
      };
    },
    async fetchEmployeeInsights(input) {
      return {
        provider: 'firecrawl',
        entity: 'employee',
        contact_id: input.contact_id,
        payload: null,
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

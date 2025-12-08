import type { SupabaseClient } from '@supabase/supabase-js';

export interface ExaClient {
  createWebset(input: { name: string; queries: string[] }): Promise<{ id: string }>;
  getWebsetItems(input: { websetId: string; limit?: number }): Promise<{ items: Array<{ url: string; title?: string }> }>;
}

export interface ExaResearchClient {
  researchCompany(input: {
    companyName: string;
    website?: string | null;
    country?: string | null;
  }): Promise<{ summary: string; sources: Array<{ url: string; title?: string }> }>;
  researchContact(input: {
    fullName: string;
    companyName?: string | null;
    role?: string | null;
    linkedinUrl?: string | null;
    website?: string | null;
  }): Promise<{ summary: string; sources: Array<{ url: string; title?: string }> }>;
}

function createExaFetcherFromEnv() {
  const apiKey = process.env.EXA_API_KEY;
  const base = process.env.EXA_API_BASE || 'https://api.exa.ai';

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('EXA_API_KEY is required to use Exa discovery');
  }

  const baseUrl = base.replace(/\/+$/, '');

  const doFetch = async (path: string, init: RequestInit): Promise<any> => {
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Exa request failed: ${res.status} ${text}`);
    }
    return res.json();
  };

  return { baseUrl, doFetch };
}

export function buildExaClientFromEnv(): ExaClient {
  const { doFetch } = createExaFetcherFromEnv();

  return {
    async createWebset(input) {
      const body = {
        name: input.name,
        queries: input.queries,
      };
      const data = await doFetch('/websets', { method: 'POST', body: JSON.stringify(body) });
      return { id: data.id as string };
    },
    async getWebsetItems(input) {
      const params = new URLSearchParams();
      if (input.limit) params.set('limit', String(input.limit));
      const data = await doFetch(`/websets/${encodeURIComponent(input.websetId)}/items?${params.toString()}`, {
        method: 'GET',
      });
      const items = Array.isArray(data.items) ? data.items : [];
      return {
        items: items.map((it: any) => ({
          url: String(it.url ?? ''),
          title: typeof it.title === 'string' ? it.title : undefined,
        })),
      };
    },
  };
}

export function buildExaResearchClientFromEnv(): ExaResearchClient {
  const { doFetch } = createExaFetcherFromEnv();

  const extractSources = (data: any) => {
    const items = Array.isArray(data?.sources) ? data.sources : [];
    return items.map((it: any) => ({
      url: String(it.url ?? ''),
      title: typeof it.title === 'string' ? it.title : undefined,
    }));
  };

  return {
    async researchCompany(input) {
      const queryParts = [
        `Provide a concise B2B sales-focused summary of the company ${input.companyName}.`,
        input.website ? `Website: ${input.website}.` : null,
        input.country ? `Country: ${input.country}.` : null,
      ].filter(Boolean);

      const body = {
        query: queryParts.join(' '),
      };

      const data = await doFetch('/answer', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      return {
        summary: typeof data?.answer === 'string' ? data.answer : '',
        sources: extractSources(data),
      };
    },
    async researchContact(input) {
      const queryParts = [
        `Provide a concise B2B sales-focused summary for the contact ${input.fullName}.`,
        input.role ? `Role: ${input.role}.` : null,
        input.companyName ? `Company: ${input.companyName}.` : null,
        input.website ? `Company website: ${input.website}.` : null,
        input.linkedinUrl ? `LinkedIn: ${input.linkedinUrl}.` : null,
      ].filter(Boolean);

      const body = {
        query: queryParts.join(' '),
      };

      const data = await doFetch('/answer', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      return {
        summary: typeof data?.answer === 'string' ? data.answer : '',
        sources: extractSources(data),
      };
    },
  };
}

// Placeholder type to keep future Supabase-aware helpers co-located.
export type ExaSupabaseContext = {
  supabase: SupabaseClient;
  exa: ExaClient;
};

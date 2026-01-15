import { getProviderResult, isEnrichmentStoreV1 } from './store';

export type ProviderPayloadSummary = {
  type: 'null' | 'string' | 'number' | 'boolean' | 'array' | 'object' | 'unknown';
  approxChars: number | null;
  truncated: boolean;
  keys?: string[];
  sample?: unknown;
};

export type HybridProviderEnrichment =
  | {
      mode: 'full';
      company: unknown | null;
      lead: unknown | null;
      meta: {
        companyChars: number | null;
        leadChars: number | null;
        truncated: boolean;
      };
    }
  | {
      mode: 'summary';
      company_summary: ProviderPayloadSummary | null;
      lead_summary: ProviderPayloadSummary | null;
    };

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stableProviderIds(...stores: unknown[]): string[] {
  const ids = new Set<string>();
  for (const store of stores) {
    if (!isEnrichmentStoreV1(store)) continue;
    for (const key of Object.keys(store.providers ?? {})) ids.add(key);
  }
  return Array.from(ids).sort((a, b) => a.localeCompare(b));
}

function truncateString(value: string, maxLen: number): { value: string; truncated: boolean } {
  if (value.length <= maxLen) return { value, truncated: false };
  return { value: `${value.slice(0, maxLen - 1)}…`, truncated: true };
}

function pickOrderedKeys(obj: Record<string, unknown>, maxKeys: number): string[] {
  const priority = [
    'summary',
    'overview',
    'company',
    'person',
    'contact',
    'full_name',
    'name',
    'role',
    'title',
    'position',
    'industry',
    'size',
    'website',
    'domain',
    'linkedin',
    'linkedin_url',
    'emails',
    'phones',
    'locations',
    'sources',
    'links',
    'citations',
  ];

  const present = new Set(Object.keys(obj));
  const ordered: string[] = [];
  for (const key of priority) {
    if (present.has(key)) ordered.push(key);
  }
  const remaining = Array.from(present)
    .filter((k) => !ordered.includes(k))
    .sort((a, b) => a.localeCompare(b));
  return [...ordered, ...remaining].slice(0, maxKeys);
}

function pruneForSample(
  value: unknown,
  opts: { depth: number; maxKeys: number; maxItems: number; maxString: number }
): { sample: unknown; truncated: boolean } {
  if (value == null) return { sample: null, truncated: false };
  if (typeof value === 'string') {
    const out = truncateString(value, opts.maxString);
    return { sample: out.value, truncated: out.truncated };
  }
  if (typeof value === 'number' || typeof value === 'boolean') return { sample: value, truncated: false };
  if (Array.isArray(value)) {
    const items = value.slice(0, opts.maxItems);
    let truncated = value.length > items.length;
    const nextDepth = Math.max(0, opts.depth - 1);
    const pruned = items.map((v) => {
      const res = pruneForSample(v, { ...opts, depth: nextDepth });
      truncated ||= res.truncated;
      return res.sample;
    });
    return { sample: pruned, truncated };
  }
  if (!isObject(value)) return { sample: String(value), truncated: false };
  if (opts.depth <= 0) return { sample: { keys: Object.keys(value).sort().slice(0, opts.maxKeys) }, truncated: true };

  const keys = pickOrderedKeys(value, opts.maxKeys);
  const nextDepth = Math.max(0, opts.depth - 1);
  const out: Record<string, unknown> = {};
  let truncated = Object.keys(value).length > keys.length;
  for (const key of keys) {
    const res = pruneForSample(value[key], { ...opts, depth: nextDepth });
    truncated ||= res.truncated;
    out[key] = res.sample;
  }
  return { sample: out, truncated };
}

function safeJsonChars(value: unknown): number | null {
  try {
    return JSON.stringify(value).length;
  } catch {
    return null;
  }
}

export function summarizeProviderPayloadForPrompt(value: unknown, maxSummaryChars: number): ProviderPayloadSummary | null {
  if (value == null) {
    return { type: 'null', approxChars: 0, truncated: false };
  }

  const approxChars = safeJsonChars(value);

  if (typeof value === 'string') {
    const out = truncateString(value, maxSummaryChars);
    return { type: 'string', approxChars, truncated: out.truncated, sample: out.value };
  }

  const pruned = pruneForSample(value, {
    depth: 2,
    maxKeys: 12,
    maxItems: 8,
    maxString: Math.min(500, maxSummaryChars),
  });

  const prunedChars = safeJsonChars(pruned.sample);
  const overBudget = typeof prunedChars === 'number' && prunedChars > maxSummaryChars;
  const truncated = pruned.truncated || overBudget || (typeof approxChars === 'number' && approxChars > maxSummaryChars);

  if (isObject(value)) {
    const keys = Object.keys(value).sort().slice(0, 30);
    return {
      type: 'object',
      approxChars,
      truncated,
      keys,
      sample: overBudget ? { keys } : pruned.sample,
    };
  }

  if (Array.isArray(value)) {
    return {
      type: 'array',
      approxChars,
      truncated,
      sample: pruned.sample,
    };
  }

  const t = typeof value;
  if (t === 'number' || t === 'boolean') {
    return { type: t, approxChars, truncated: false, sample: value };
  }

  return { type: 'unknown', approxChars, truncated, sample: pruned.sample };
}

export function buildHybridEnrichmentByProvider(params: {
  primaryProvider: string;
  companyStore: unknown;
  employeeStore: unknown;
  maxPrimaryChars?: number;
  maxSupplementalChars?: number;
}): Record<string, HybridProviderEnrichment> | null {
  const providerIds = stableProviderIds(params.companyStore, params.employeeStore);
  if (providerIds.length === 0) return null;

  const maxPrimaryChars = params.maxPrimaryChars ?? 25000;
  const maxSupplementalChars = params.maxSupplementalChars ?? 5000;

  const out: Record<string, HybridProviderEnrichment> = {};

  for (const providerId of providerIds) {
    const company = getProviderResult(params.companyStore, providerId);
    const lead = getProviderResult(params.employeeStore, providerId);

    if (providerId === params.primaryProvider) {
      const companyChars = safeJsonChars(company);
      const leadChars = safeJsonChars(lead);
      const shouldSummarize =
        (typeof companyChars === 'number' && companyChars > maxPrimaryChars) ||
        (typeof leadChars === 'number' && leadChars > maxPrimaryChars);

      if (!shouldSummarize) {
        out[providerId] = {
          mode: 'full',
          company,
          lead,
          meta: {
            companyChars,
            leadChars,
            truncated: false,
          },
        };
        continue;
      }

      out[providerId] = {
        mode: 'summary',
        company_summary: summarizeProviderPayloadForPrompt(company, maxSupplementalChars),
        lead_summary: summarizeProviderPayloadForPrompt(lead, maxSupplementalChars),
      };
      continue;
    }

    out[providerId] = {
      mode: 'summary',
      company_summary: summarizeProviderPayloadForPrompt(company, maxSupplementalChars),
      lead_summary: summarizeProviderPayloadForPrompt(lead, maxSupplementalChars),
    };
  }

  return out;
}


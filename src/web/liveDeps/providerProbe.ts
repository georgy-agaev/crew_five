import type { EnrichmentProviderId } from '../../services/enrichmentSettings.js';

function withTimeout(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

export async function probeEnrichmentProvider(
  providerId: EnrichmentProviderId
): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (providerId === 'mock') return { ok: true };

    if (providerId === 'exa') {
      const apiKey = process.env.EXA_API_KEY;
      if (!apiKey) return { ok: false, reason: 'missing EXA_API_KEY' };
      const base = (process.env.EXA_API_BASE || 'https://api.exa.ai').replace(/\/+$/, '');
      const t = withTimeout(12000);
      try {
        const res = await fetch(`${base}/answer`, {
          method: 'POST',
          signal: t.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ query: 'Reply with the single word OK.' }),
        });
        if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
        return { ok: true };
      } finally {
        t.done();
      }
    }

    if (providerId === 'firecrawl') {
      const apiKey = process.env.FIRECRAWL_API_KEY;
      if (!apiKey) return { ok: false, reason: 'missing FIRECRAWL_API_KEY' };
      const base = (process.env.FIRECRAWL_API_BASE || 'https://api.firecrawl.dev').replace(/\/+$/, '');
      const t = withTimeout(12000);
      try {
        const res = await fetch(`${base}/v1/search`, {
          method: 'POST',
          signal: t.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ query: 'site:example.com example', limit: 1 }),
        });
        if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
        return { ok: true };
      } finally {
        t.done();
      }
    }

    if (providerId === 'anysite') {
      const token = process.env.ANYSITE_API_KEY;
      if (!token) return { ok: false, reason: 'missing ANYSITE_API_KEY' };
      const base = (process.env.ANYSITE_API_BASE || 'https://api.anysite.io').replace(/\/+$/, '');
      const t = withTimeout(12000);
      try {
        const res = await fetch(`${base}/api/webparser/parse`, {
          method: 'POST',
          signal: t.signal,
          headers: { 'Content-Type': 'application/json', 'access-token': token },
          body: JSON.stringify({ url: 'https://example.com', extract_minimal: true }),
        });
        if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
        return { ok: true };
      } finally {
        t.done();
      }
    }

    if (providerId === 'parallel') {
      const apiKey = process.env.PARALLEL_API_KEY;
      if (!apiKey) return { ok: false, reason: 'missing PARALLEL_API_KEY' };
      const base = (process.env.PARALLEL_API_BASE || 'https://api.parallel.ai').replace(/\/+$/, '');
      const t = withTimeout(12000);
      try {
        const res = await fetch(`${base}/openapi.json`, {
          method: 'GET',
          signal: t.signal,
          headers: { 'x-api-key': apiKey },
        });
        if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
        return { ok: true };
      } finally {
        t.done();
      }
    }

    return { ok: false, reason: 'unknown provider' };
  } catch (err: any) {
    return { ok: false, reason: err?.message ?? 'probe failed' };
  }
}

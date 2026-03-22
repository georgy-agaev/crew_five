export type EnrichmentStoreV1 = {
  version: 1;
  providers: Record<string, unknown>;
  lastUpdatedAt: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isEnrichmentStoreV1(value: unknown): value is EnrichmentStoreV1 {
  if (!isObject(value)) return false;
  return value.version === 1 && isObject(value.providers) && typeof value.lastUpdatedAt === 'string';
}

export function upsertProviderResult(params: {
  existing: unknown;
  provider: string;
  result: unknown;
  now?: Date;
}): EnrichmentStoreV1 {
  const nowIso = (params.now ?? new Date()).toISOString();

  if (isEnrichmentStoreV1(params.existing)) {
    return {
      version: 1,
      providers: {
        ...params.existing.providers,
        [params.provider]: params.result,
      },
      lastUpdatedAt: nowIso,
    };
  }

  return {
    version: 1,
    providers: { [params.provider]: params.result },
    lastUpdatedAt: nowIso,
  };
}

export function getProviderResult(store: unknown, provider: string): unknown | null {
  if (!isEnrichmentStoreV1(store)) return null;
  return store.providers?.[provider] ?? null;
}


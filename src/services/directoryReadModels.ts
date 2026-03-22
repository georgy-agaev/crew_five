import type { SupabaseClient } from '@supabase/supabase-js';

type EnrichmentStatus = 'fresh' | 'stale' | 'missing';
type EmailStatus = 'work' | 'generic' | 'missing';
type EmailDeliverabilityStatus = 'unknown' | 'valid' | 'invalid' | 'bounced';

export interface DirectoryCompanyView {
  companyId: string;
  companyName: string | null;
  segment: string | null;
  status: string | null;
  website: string | null;
  employeeCount: number | null;
  officeQualification: string | null;
  registrationDate: string | null;
  updatedAt: string | null;
  enrichment: {
    status: EnrichmentStatus;
    lastUpdatedAt: string | null;
    providerHint: string | null;
  };
  contacts: {
    total: number;
    withWorkEmail: number;
    withAnyEmail: number;
    missingEmail: number;
  };
  flags: {
    hasWebsite: boolean;
    hasResearch: boolean;
  };
}

export interface DirectoryCompaniesView {
  items: DirectoryCompanyView[];
  summary: {
    total: number;
    enrichment: Record<EnrichmentStatus, number>;
    segments: Array<{ segment: string; count: number }>;
  };
}

export interface DirectoryContactView {
  contactId: string;
  companyId: string | null;
  companyName: string | null;
  companySegment: string | null;
  companyStatus: string | null;
  fullName: string | null;
  position: string | null;
  workEmail: string | null;
  genericEmail: string | null;
  emailStatus: EmailStatus;
  workEmailStatus: EmailDeliverabilityStatus;
  genericEmailStatus: EmailDeliverabilityStatus;
  processingStatus: string | null;
  updatedAt: string | null;
  enrichment: {
    status: EnrichmentStatus;
    lastUpdatedAt: string | null;
    providerHint: string | null;
  };
}

export interface DirectoryContactsView {
  items: DirectoryContactView[];
  summary: {
    total: number;
    emailStatus: Record<EmailStatus, number>;
    enrichment: Record<EnrichmentStatus, number>;
  };
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function deriveProviderHint(store: unknown): string | null {
  const providers = (store as { providers?: Record<string, unknown> } | null)?.providers;
  if (!providers || typeof providers !== 'object' || Array.isArray(providers)) {
    return null;
  }
  const keys = Object.keys(providers).filter((key) => key.trim().length > 0).sort();
  return keys.length > 0 ? keys.join('/') : null;
}

function deriveEnrichment(
  store: unknown,
  fallbackUpdatedAt: string | null | undefined,
  maxAgeDays = 90
): DirectoryCompanyView['enrichment'] {
  if (!store) {
    return { status: 'missing', lastUpdatedAt: null, providerHint: null };
  }

  const typedStore = store as { lastUpdatedAt?: unknown };
  const lastUpdatedAt =
    typeof typedStore.lastUpdatedAt === 'string' && typedStore.lastUpdatedAt.trim().length > 0
      ? typedStore.lastUpdatedAt
      : fallbackUpdatedAt ?? null;
  const updatedAtDate = parseIsoDate(lastUpdatedAt);
  const providerHint = deriveProviderHint(store);

  if (!updatedAtDate) {
    return {
      status: 'stale',
      lastUpdatedAt,
      providerHint,
    };
  }

  const ageMs = Date.now() - updatedAtDate.getTime();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  return {
    status: ageMs > maxAgeMs ? 'stale' : 'fresh',
    lastUpdatedAt: updatedAtDate.toISOString(),
    providerHint,
  };
}

function deriveEmailStatus(workEmail: string | null, genericEmail: string | null): EmailStatus {
  if (workEmail) return 'work';
  if (genericEmail) return 'generic';
  return 'missing';
}

function deriveEmailDeliverabilityStatus(value: unknown): EmailDeliverabilityStatus {
  return value === 'valid' || value === 'invalid' || value === 'bounced' ? value : 'unknown';
}

function includesQuery(parts: Array<string | null | undefined>, query?: string) {
  if (!query) return true;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return parts.some((part) => part?.toLowerCase().includes(needle));
}

function makeSummaryCounts<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
}

export async function listDirectoryCompanies(
  client: SupabaseClient,
  filters: {
    segment?: string;
    enrichmentStatus?: EnrichmentStatus;
    query?: string;
    limit?: number;
  }
): Promise<DirectoryCompaniesView> {
  let companiesQuery = client
    .from('companies')
    .select('id,company_name,segment,status,website,employee_count,office_qualification,registration_date,updated_at,company_research')
    .order('updated_at', { ascending: false });
  if (filters.segment) {
    companiesQuery = companiesQuery.eq('segment', filters.segment);
  }
  const { data: companies, error } = await companiesQuery;
  if (error) throw error;

  const companyRows = (companies ?? []) as Array<Record<string, unknown>>;
  const companyIds = companyRows.map((row) => String(row.id));
  const contactCounts = new Map<string, DirectoryCompanyView['contacts']>();
  if (companyIds.length > 0) {
    const { data: employees, error: employeeError } = await client
      .from('employees')
      .select('company_id,work_email,generic_email')
      .in('company_id', companyIds);
    if (employeeError) throw employeeError;
    for (const row of (employees ?? []) as Array<{ company_id: string; work_email?: string | null; generic_email?: string | null }>) {
      const current = contactCounts.get(row.company_id) ?? {
        total: 0,
        withWorkEmail: 0,
        withAnyEmail: 0,
        missingEmail: 0,
      };
      current.total += 1;
      if (row.work_email) current.withWorkEmail += 1;
      if (row.work_email || row.generic_email) current.withAnyEmail += 1;
      if (!row.work_email && !row.generic_email) current.missingEmail += 1;
      contactCounts.set(row.company_id, current);
    }
  }

  const items = companyRows
    .map((row): DirectoryCompanyView => {
      const enrichment = deriveEnrichment(row.company_research, row.updated_at as string | null | undefined);
      return {
        companyId: String(row.id),
        companyName: (row.company_name as string | null | undefined) ?? null,
        segment: (row.segment as string | null | undefined) ?? null,
        status: (row.status as string | null | undefined) ?? null,
        website: (row.website as string | null | undefined) ?? null,
        employeeCount: typeof row.employee_count === 'number' ? row.employee_count : null,
        officeQualification: (row.office_qualification as string | null | undefined) ?? null,
        registrationDate: (row.registration_date as string | null | undefined) ?? null,
        updatedAt: (row.updated_at as string | null | undefined) ?? null,
        enrichment,
        contacts: contactCounts.get(String(row.id)) ?? {
          total: 0,
          withWorkEmail: 0,
          withAnyEmail: 0,
          missingEmail: 0,
        },
        flags: {
          hasWebsite: Boolean(row.website),
          hasResearch: Boolean(row.company_research),
        },
      };
    })
    .filter((item) => (filters.enrichmentStatus ? item.enrichment.status === filters.enrichmentStatus : true))
    .filter((item) => includesQuery([item.companyName, item.website, item.segment], filters.query));

  const limitedItems = filters.limit ? items.slice(0, filters.limit) : items;
  const segmentCounts = new Map<string, number>();
  for (const item of items) {
    const key = item.segment ?? 'Unassigned';
    segmentCounts.set(key, (segmentCounts.get(key) ?? 0) + 1);
  }
  const enrichment = makeSummaryCounts(['fresh', 'stale', 'missing'] as const);
  for (const item of items) {
    enrichment[item.enrichment.status] += 1;
  }

  return {
    items: limitedItems,
    summary: {
      total: items.length,
      enrichment,
      segments: Array.from(segmentCounts.entries())
        .map(([segment, count]) => ({ segment, count }))
        .sort((left, right) => right.count - left.count || left.segment.localeCompare(right.segment)),
    },
  };
}

export async function listDirectoryContacts(
  client: SupabaseClient,
  filters: {
    companyIds?: string[];
    segment?: string;
    emailStatus?: EmailStatus;
    enrichmentStatus?: EnrichmentStatus;
    query?: string;
    limit?: number;
  }
): Promise<DirectoryContactsView> {
  let contactsQuery = client
    .from('employees')
    .select(
      'id,company_id,company_name,full_name,position,work_email,work_email_status,generic_email,generic_email_status,updated_at,ai_research_data,processing_status'
    );
  if (filters.companyIds?.length) {
    contactsQuery = contactsQuery.in('company_id', filters.companyIds);
  }
  if (filters.limit && !filters.companyIds?.length) {
    contactsQuery = contactsQuery.limit(Math.max(filters.limit, 200));
  } else if (!filters.companyIds?.length) {
    contactsQuery = contactsQuery.limit(5000);
  }
  const { data: contacts, error } = await contactsQuery;
  if (error) throw error;

  const contactRows = (contacts ?? []) as Array<Record<string, unknown>>;
  const companyIds = Array.from(
    new Set(contactRows.map((row) => String(row.company_id ?? '')).filter(Boolean))
  );
  const companyMeta = new Map<string, { segment: string | null; status: string | null }>();
  if (companyIds.length > 0) {
    const { data: companies, error: companyError } = await client
      .from('companies')
      .select('id,segment,status')
      .in('id', companyIds);
    if (companyError) throw companyError;
    for (const row of (companies ?? []) as Array<{ id: string; segment?: string | null; status?: string | null }>) {
      companyMeta.set(String(row.id), {
        segment: row.segment ?? null,
        status: row.status ?? null,
      });
    }
  }

  const items = contactRows
    .map((row): DirectoryContactView => {
      const companyId = (row.company_id as string | null | undefined) ?? null;
      const emailStatus = deriveEmailStatus(
        (row.work_email as string | null | undefined) ?? null,
        (row.generic_email as string | null | undefined) ?? null
      );
      const company = companyId ? companyMeta.get(companyId) : undefined;
      return {
        contactId: String(row.id),
        companyId,
        companyName: (row.company_name as string | null | undefined) ?? null,
        companySegment: company?.segment ?? null,
        companyStatus: company?.status ?? null,
        fullName: (row.full_name as string | null | undefined) ?? null,
        position: (row.position as string | null | undefined) ?? null,
        workEmail: (row.work_email as string | null | undefined) ?? null,
        genericEmail: (row.generic_email as string | null | undefined) ?? null,
        emailStatus,
        workEmailStatus: deriveEmailDeliverabilityStatus(row.work_email_status),
        genericEmailStatus: deriveEmailDeliverabilityStatus(row.generic_email_status),
        processingStatus: (row.processing_status as string | null | undefined) ?? null,
        updatedAt: (row.updated_at as string | null | undefined) ?? null,
        enrichment: deriveEnrichment(row.ai_research_data, row.updated_at as string | null | undefined),
      };
    })
    .filter((item) => (filters.companyIds?.length ? filters.companyIds.includes(item.companyId ?? '') : true))
    .filter((item) => (filters.segment ? item.companySegment === filters.segment : true))
    .filter((item) => (filters.emailStatus ? item.emailStatus === filters.emailStatus : true))
    .filter((item) => (filters.enrichmentStatus ? item.enrichment.status === filters.enrichmentStatus : true))
    .filter((item) =>
      includesQuery([item.fullName, item.position, item.companyName, item.workEmail, item.genericEmail], filters.query)
    );

  const limitedItems = filters.limit ? items.slice(0, filters.limit) : items;
  const emailStatus = makeSummaryCounts(['work', 'generic', 'missing'] as const);
  const enrichment = makeSummaryCounts(['fresh', 'stale', 'missing'] as const);
  for (const item of items) {
    emailStatus[item.emailStatus] += 1;
    enrichment[item.enrichment.status] += 1;
  }

  return {
    items: limitedItems,
    summary: {
      total: items.length,
      emailStatus,
      enrichment,
    },
  };
}

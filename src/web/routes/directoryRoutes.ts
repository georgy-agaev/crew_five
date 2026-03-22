import type { AdapterDeps, DispatchRequest, DispatchResponse } from '../types.js';

function parseDirectoryEnrichmentStatus(
  value: string | null
): 'fresh' | 'stale' | 'missing' | undefined {
  return value === 'fresh' || value === 'stale' || value === 'missing' ? value : undefined;
}

function parseDirectoryEmailStatus(
  value: string | null
): 'work' | 'generic' | 'missing' | undefined {
  return value === 'work' || value === 'generic' || value === 'missing' ? value : undefined;
}

function parseRepairConfidence(value: string | null): 'high' | 'low' | 'all' | undefined {
  return value === 'high' || value === 'low' || value === 'all' ? value : undefined;
}

export async function handleDirectoryRoutes(
  deps: AdapterDeps,
  req: DispatchRequest
): Promise<DispatchResponse | null> {
  const { method, pathname, searchParams = new URLSearchParams() } = req;
  const markInvalidMatch =
    method === 'POST'
      ? pathname.match(/^\/api\/directory\/contacts\/([^/]+)\/mark-invalid$/)
      : null;
  const deleteMatch =
    method === 'POST' ? pathname.match(/^\/api\/directory\/contacts\/([^/]+)\/delete$/) : null;
  const companyMarkInvalidMatch =
    method === 'POST'
      ? pathname.match(/^\/api\/directory\/companies\/([^/]+)\/mark-invalid$/)
      : null;
  const companyDeleteMatch =
    method === 'POST' ? pathname.match(/^\/api\/directory\/companies\/([^/]+)\/delete$/) : null;
  const contactUpdateMatch =
    method === 'POST' ? pathname.match(/^\/api\/directory\/contacts\/([^/]+)\/update$/) : null;
  const companyUpdateMatch =
    method === 'POST' ? pathname.match(/^\/api\/directory\/companies\/([^/]+)\/update$/) : null;

  if (method === 'GET' && pathname === '/api/directory/companies') {
    if (!deps.listDirectoryCompanies) {
      return { status: 501, body: { error: 'Directory companies not configured' } };
    }
    return {
      status: 200,
      body: await deps.listDirectoryCompanies({
        segment: searchParams.get('segment') ?? undefined,
        enrichmentStatus: parseDirectoryEnrichmentStatus(searchParams.get('enrichmentStatus')),
        query: searchParams.get('q') ?? undefined,
        limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      }),
    };
  }

  if (method === 'GET' && pathname === '/api/directory/contacts') {
    if (!deps.listDirectoryContacts) {
      return { status: 501, body: { error: 'Directory contacts not configured' } };
    }
    const companyIds = searchParams.get('companyIds');
    return {
      status: 200,
      body: await deps.listDirectoryContacts({
        companyIds: companyIds ? companyIds.split(',').filter(Boolean) : undefined,
        segment: searchParams.get('segment') ?? undefined,
        emailStatus: parseDirectoryEmailStatus(searchParams.get('emailStatus')),
        enrichmentStatus: parseDirectoryEnrichmentStatus(searchParams.get('enrichmentStatus')),
        query: searchParams.get('q') ?? undefined,
        limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      }),
    };
  }

  if (method === 'GET' && pathname === '/api/directory/employee-name-repairs') {
    if (!deps.previewEmployeeNameRepairs) {
      return { status: 501, body: { error: 'Employee name repair preview not configured' } };
    }
    return {
      status: 200,
      body: await deps.previewEmployeeNameRepairs({
        confidence: parseRepairConfidence(searchParams.get('confidence')),
      }),
    };
  }

  if (method === 'POST' && pathname === '/api/directory/employee-name-repairs/apply') {
    if (!deps.applyEmployeeNameRepairs) {
      return { status: 501, body: { error: 'Employee name repair apply not configured' } };
    }
    const body = req.body ?? {};
    return {
      status: 200,
      body: await deps.applyEmployeeNameRepairs({
        confidence: parseRepairConfidence(typeof body.confidence === 'string' ? body.confidence : null),
      }),
    };
  }

  if (markInvalidMatch) {
    if (!deps.markDirectoryContactInvalid) {
      return { status: 501, body: { error: 'Directory contact invalidation not configured' } };
    }
    return {
      status: 200,
      body: await deps.markDirectoryContactInvalid(markInvalidMatch[1]),
    };
  }

  if (deleteMatch) {
    if (!deps.deleteDirectoryContact) {
      return { status: 501, body: { error: 'Directory contact delete not configured' } };
    }
    try {
      return {
        status: 200,
        body: await deps.deleteDirectoryContact(deleteMatch[1]),
      };
    } catch (err: unknown) {
      const error = err as Error & { code?: string; details?: Record<string, unknown> };
      if (error.code === 'CONTACT_DELETE_CONFLICT') {
        return {
          status: 409,
          body: { error: error.message, details: error.details ?? null },
        };
      }
      throw err;
    }
  }

  if (companyMarkInvalidMatch) {
    if (!deps.markDirectoryCompanyInvalid) {
      return { status: 501, body: { error: 'Directory company invalidation not configured' } };
    }
    return {
      status: 200,
      body: await deps.markDirectoryCompanyInvalid(companyMarkInvalidMatch[1]),
    };
  }

  if (companyDeleteMatch) {
    if (!deps.deleteDirectoryCompany) {
      return { status: 501, body: { error: 'Directory company delete not configured' } };
    }
    try {
      return {
        status: 200,
        body: await deps.deleteDirectoryCompany(companyDeleteMatch[1]),
      };
    } catch (err: unknown) {
      const error = err as Error & { code?: string; details?: Record<string, unknown> };
      if (error.code === 'COMPANY_DELETE_CONFLICT') {
        return {
          status: 409,
          body: { error: error.message, details: error.details ?? null },
        };
      }
      throw err;
    }
  }

  if (contactUpdateMatch) {
    if (!deps.updateDirectoryContact) {
      return { status: 501, body: { error: 'Directory contact update not configured' } };
    }
    return {
      status: 200,
      body: await deps.updateDirectoryContact(contactUpdateMatch[1], req.body ?? {}),
    };
  }

  if (companyUpdateMatch) {
    if (!deps.updateDirectoryCompany) {
      return { status: 501, body: { error: 'Directory company update not configured' } };
    }
    return {
      status: 200,
      body: await deps.updateDirectoryCompany(companyUpdateMatch[1], req.body ?? {}),
    };
  }

  return null;
}

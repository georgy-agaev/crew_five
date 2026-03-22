import type { AdapterDeps, DispatchRequest, DispatchResponse } from '../types.js';

export async function handleProjectRoutes(
  deps: AdapterDeps,
  req: DispatchRequest
): Promise<DispatchResponse | null> {
  const { method, pathname, searchParams = new URLSearchParams() } = req;

  if (method === 'GET' && pathname === '/api/projects') {
    if (!deps.listProjects) {
      return { status: 501, body: { error: 'Project listing not configured' } };
    }
    try {
      const status = searchParams.get('status') ?? undefined;
      return { status: 200, body: await deps.listProjects({ ...(status ? { status: status as any } : {}) }) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Project list failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'POST' && pathname === '/api/projects') {
    if (!deps.createProject) {
      return { status: 501, body: { error: 'Project creation not configured' } };
    }
    const body = req.body ?? {};
    if (typeof body.key !== 'string' || body.key.trim().length === 0) {
      return { status: 400, body: { error: 'key is required' } };
    }
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      return { status: 400, body: { error: 'name is required' } };
    }
    try {
      return {
        status: 201,
        body: await deps.createProject({
          key: body.key,
          name: body.name,
          description: typeof body.description === 'string' ? body.description : null,
          status: typeof body.status === 'string' ? body.status : undefined,
        }),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Project creation failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'PUT' && pathname.startsWith('/api/projects/')) {
    if (!deps.updateProject) {
      return { status: 501, body: { error: 'Project update not configured' } };
    }
    const projectId = pathname.slice('/api/projects/'.length).replace(/\/$/, '');
    if (!projectId) {
      return { status: 400, body: { error: 'projectId is required' } };
    }
    const body = req.body ?? {};
    try {
      return {
        status: 200,
        body: await deps.updateProject(projectId, {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
        }),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Project update failed';
      return { status: 500, body: { error: message } };
    }
  }

  return null;
}

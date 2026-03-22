import type { AdapterDeps, DispatchRequest, DispatchResponse } from '../types.js';

export async function handlePromptRoutes(
  deps: AdapterDeps,
  req: DispatchRequest
): Promise<DispatchResponse | null> {
  const { method, pathname, searchParams = new URLSearchParams() } = req;

  if (method === 'GET' && pathname === '/api/prompt-registry') {
    if (!deps.listPromptRegistry) {
      return { status: 501, body: { error: 'Prompt registry not configured' } };
    }
    const rows = await deps.listPromptRegistry();
    const stepFilter = searchParams.get('step') ?? undefined;
    const enriched = (rows ?? []).map((row: any) => {
      const coachPromptId = row.coach_prompt_id ?? row.id;
      return {
        ...row,
        id: coachPromptId,
        coach_prompt_id: coachPromptId,
        is_active: row.rollout_status === 'active',
      };
    });
    return {
      status: 200,
      body: stepFilter ? enriched.filter((row) => row.step === stepFilter) : enriched,
    };
  }

  if (method === 'POST' && pathname === '/api/prompt-registry') {
    if (!deps.createPromptRegistryEntry) {
      return { status: 501, body: { error: 'Prompt registry not configured' } };
    }
    return { status: 200, body: await deps.createPromptRegistryEntry(req.body ?? {}) };
  }

  if (method === 'GET' && pathname === '/api/prompt-registry/active') {
    if (!deps.getActivePromptForStep) {
      return { status: 501, body: { error: 'Prompt registry not configured' } };
    }
    const step = searchParams.get('step');
    if (!step) return { status: 400, body: { error: 'step is required' } };
    return {
      status: 200,
      body: { step, coach_prompt_id: (await deps.getActivePromptForStep(step)) ?? null },
    };
  }

  if (method === 'POST' && pathname === '/api/prompt-registry/active') {
    if (!deps.setActivePromptForStep) {
      return { status: 501, body: { error: 'Prompt registry not configured' } };
    }
    const body = req.body ?? {};
    if (!body.step) return { status: 400, body: { error: 'step is required' } };
    if (!body.coach_prompt_id) {
      return { status: 400, body: { error: 'coach_prompt_id is required' } };
    }
    await deps.setActivePromptForStep(body.step, body.coach_prompt_id);
    return { status: 200, body: { ok: true } };
  }

  if (method === 'GET' && pathname === '/api/llm/models') {
    const provider = (searchParams.get('provider') ?? '').toLowerCase();
    if (!provider || (provider !== 'openai' && provider !== 'anthropic')) {
      return { status: 400, body: { error: 'Unsupported provider for LLM models' } };
    }
    if (!deps.listLlmModels) {
      return { status: 501, body: { error: 'LLM models endpoint not configured' } };
    }
    try {
      return { status: 200, body: await deps.listLlmModels(provider) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to list LLM models';
      return { status: 500, body: { error: message } };
    }
  }

  return null;
}

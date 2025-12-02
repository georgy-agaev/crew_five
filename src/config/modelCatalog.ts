type Task = 'assistant' | 'icp' | 'hypothesis' | 'draft';

type Provider = 'openai' | 'anthropic' | 'gemini';

export interface ModelEntry {
  provider: Provider;
  model: string;
  tasks: Task[];
  cost: 'low' | 'medium' | 'high';
  latency: 'low' | 'medium' | 'high';
  recommended: boolean;
}

const catalog: ModelEntry[] = [
  {
    provider: 'openai',
    model: 'gpt-4o-mini',
    tasks: ['draft', 'hypothesis', 'icp'],
    cost: 'low',
    latency: 'low',
    recommended: true,
  },
  {
    provider: 'openai',
    model: 'gpt-4o',
    tasks: ['assistant'],
    cost: 'medium',
    latency: 'medium',
    recommended: true,
  },
  {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
    tasks: ['draft', 'hypothesis', 'icp', 'assistant'],
    cost: 'medium',
    latency: 'medium',
    recommended: true,
  },
  {
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    tasks: ['draft', 'hypothesis', 'icp'],
    cost: 'low',
    latency: 'low',
    recommended: true,
  },
];

export function getRecommendedModels(): ModelEntry[] {
  return catalog;
}

export function assertSupportedModel(provider: string, model: string) {
  const match = catalog.find((m) => m.provider === provider && m.model === model);
  if (!match) {
    throw new Error(`Unsupported model: ${provider}/${model}`);
  }
}

export function resolveModelConfig(input: {
  provider?: string;
  model?: string;
  task?: Task;
}): { provider: Provider; model: string } {
  const task = input.task ?? 'draft';
  if (input.provider && input.model) {
    assertSupportedModel(input.provider, input.model);
    return { provider: input.provider as Provider, model: input.model };
  }

  const provider = (input.provider as Provider) ?? defaultProviderForTask(task);
  const model = input.model ?? defaultModelForTask(provider, task);
  assertSupportedModel(provider, model);
  return { provider, model };
}

function defaultProviderForTask(): Provider {
  return 'openai';
}

function defaultModelForTask(provider: Provider, task: Task): string {
  const candidates = catalog.filter((m) => m.provider === provider && m.tasks.includes(task) && m.recommended);
  if (candidates.length === 0) {
    throw new Error(`No recommended model for provider ${provider} and task ${task}`);
  }
  return candidates[0].model;
}

import { getRecommendedModels, type ModelEntry } from '../../../../src/config/modelCatalog';
import type { PromptEntry, PromptStep } from '../../apiClient';

export type TaskKey = 'icpDiscovery' | 'hypothesisGen' | 'emailDraft' | 'linkedinMsg';

export type TaskPromptsState = {
  icpDiscovery?: string;
  hypothesisGen?: string;
  emailDraft?: string;
  linkedinMsg?: string;
};

export type ProviderTaskKey = 'assistant' | 'icp' | 'hypothesis' | 'draft';

const modelCatalog: ModelEntry[] = getRecommendedModels();

export function getPromptOptions(entries: PromptEntry[]) {
  return (entries ?? []).map((entry) => ({
    value: entry.id,
    label: entry.version ? `${entry.id} (${entry.version})` : entry.id,
  }));
}

export function setTaskPrompt(
  prev: TaskPromptsState,
  task: TaskKey,
  promptId: string | undefined
): TaskPromptsState {
  return {
    ...prev,
    [task]: promptId || undefined,
  };
}

export function getTaskSelectionLabel(taskPrompts: TaskPromptsState, task: TaskKey): string | null {
  return taskPrompts?.[task] ?? null;
}

export function mapTaskToProviderKey(task: TaskKey): ProviderTaskKey {
  if (task === 'icpDiscovery') return 'icp';
  if (task === 'hypothesisGen') return 'hypothesis';
  return 'draft';
}

export function getModelOptionsForProvider(
  provider: string,
  llmModels: Record<string, string[] | undefined>
) {
  const live = llmModels[provider];
  if (live && live.length) {
    const unique = Array.from(new Set(live));
    const recommended = new Set(
      modelCatalog.filter((entry) => entry.provider === provider && entry.recommended).map((entry) => entry.model)
    );
    const ordered = [
      ...unique.filter((id) => recommended.has(id)),
      ...unique.filter((id) => !recommended.has(id)),
    ];
    return ordered.map((id) => ({ value: id, label: id }));
  }

  return modelCatalog
    .filter((entry) => entry.provider === provider)
    .map((entry) => ({ value: entry.model, label: entry.model }));
}

export function mapTaskToPromptStep(task: TaskKey): PromptStep | null {
  if (task === 'icpDiscovery') return 'icp_profile';
  if (task === 'hypothesisGen') return 'icp_hypothesis';
  if (task === 'emailDraft') return 'draft';
  return null;
}

export function getPromptOptionsForStep(entries: PromptEntry[], step: PromptStep) {
  return entries
    .filter((entry) => entry.step === step)
    .map((entry) => ({
      value: entry.id,
      label: entry.version ? `${entry.id} (${entry.version})` : entry.id,
    }));
}

export async function applyActivePromptSelection(
  step: PromptStep | null,
  coachPromptId: string,
  deps: {
    setActivePromptApi: (step: PromptStep, coachPromptId: string) => Promise<void>;
    fetchPromptRegistryApi: () => Promise<PromptEntry[]>;
  }
): Promise<PromptEntry[] | null> {
  if (!step || !coachPromptId) return null;
  await deps.setActivePromptApi(step, coachPromptId);
  return deps.fetchPromptRegistryApi();
}

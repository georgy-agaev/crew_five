import type { PromptEntry } from '../../apiClient';
import type { Settings } from '../../hooks/useSettingsStore';
import { LegacyLlmModelsPanel } from './LegacyLlmModelsPanel';
import { LegacyPromptCreateForm } from './LegacyPromptCreateForm';
import { LegacyPromptRegistryApiInfo } from './LegacyPromptRegistryApiInfo';
import { LegacyPromptRegistryTable } from './LegacyPromptRegistryTable';
import { LegacyPromptRegistryToolbar } from './LegacyPromptRegistryToolbar';
import { LegacyPromptTaskConfig } from './LegacyPromptTaskConfig';
import type { TaskKey, TaskPromptsState } from './legacyWorkspacePromptHelpers';
import type {
  LegacyWorkspaceColors,
  PromptRegistryCreateFormState,
  PromptRegistryFilterStatus,
} from './legacyWorkspaceTypes';

type PromptRegistryPageCopy = {
  title: string;
  subtitle: string;
  allPrompts: string;
  active: string;
  pilot: string;
  retired: string;
  createNew: string;
  step: string;
  version: string;
  status: string;
  description: string;
  promptId: string;
  promptText: string;
  noPrompts: string;
  noPromptsDesc: string;
  setActive?: string;
  activeLabel?: string;
};

type LegacyPromptRegistryPageProps = {
  colors: LegacyWorkspaceColors;
  copy: PromptRegistryPageCopy;
  entries: PromptEntry[];
  filterStatus: PromptRegistryFilterStatus;
  llmModels: Record<string, string[] | undefined>;
  llmModelsError: Record<string, string | undefined>;
  promptCreateForm: PromptRegistryCreateFormState;
  promptError: string | null;
  promptLoading: boolean;
  settings: Settings;
  showPromptCreate: boolean;
  taskLabels: Record<TaskKey, string>;
  taskPrompts: TaskPromptsState;
  onCreateToggle: () => void;
  onDismissCreate: () => void;
  onFieldChange: (
    field: keyof Pick<
      PromptRegistryCreateFormState,
      'id' | 'version' | 'rollout_status' | 'description' | 'prompt_text'
    >,
    value: string
  ) => void;
  onFilterChange: (status: PromptRegistryFilterStatus) => void;
  onModelChange: (task: TaskKey, model: string) => void;
  onPromptChange: (task: TaskKey, promptId?: string) => void;
  onProviderChange: (task: TaskKey, provider: string, nextModel: string) => void;
  onSave: () => void | Promise<void>;
  onSetActive: (entry: PromptEntry) => Promise<void>;
};

export function LegacyPromptRegistryPage({
  colors,
  copy,
  entries,
  filterStatus,
  llmModels,
  llmModelsError,
  promptCreateForm,
  promptError,
  promptLoading,
  settings,
  showPromptCreate,
  taskLabels,
  taskPrompts,
  onCreateToggle,
  onDismissCreate,
  onFieldChange,
  onFilterChange,
  onModelChange,
  onPromptChange,
  onProviderChange,
  onSave,
  onSetActive,
}: LegacyPromptRegistryPageProps) {
  return (
    <div style={{ padding: '40px', maxWidth: '1200px' }}>
      <LegacyPromptRegistryToolbar
        colors={colors}
        copy={copy}
        filterStatus={filterStatus}
        showPromptCreate={showPromptCreate}
        onCreateToggle={onCreateToggle}
        onFilterChange={onFilterChange}
      />

      {showPromptCreate ? (
        <LegacyPromptCreateForm
          colors={colors}
          copy={copy}
          form={promptCreateForm}
          loading={promptLoading}
          onDismiss={onDismissCreate}
          onFieldChange={onFieldChange}
          onSave={onSave}
        />
      ) : null}

      <LegacyPromptTaskConfig
        colors={colors}
        llmModels={llmModels}
        promptEntries={entries}
        promptLoading={promptLoading}
        settings={settings}
        taskLabels={taskLabels}
        taskPrompts={taskPrompts}
        title="Task Configuration"
        providerLabel="Provider"
        modelLabel="Model"
        promptLabel="Prompt"
        onModelChange={onModelChange}
        onPromptChange={onPromptChange}
        onProviderChange={onProviderChange}
      />

      <LegacyLlmModelsPanel
        colors={colors}
        llmModels={llmModels}
        llmModelsError={llmModelsError}
      />

      <LegacyPromptRegistryTable
        colors={colors}
        copy={copy}
        entries={entries}
        filterStatus={filterStatus}
        loading={promptLoading}
        error={promptError}
        onSetActive={onSetActive}
      />

      <LegacyPromptRegistryApiInfo colors={colors} />
    </div>
  );
}

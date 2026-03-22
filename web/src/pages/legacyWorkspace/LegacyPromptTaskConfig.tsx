import type { PromptEntry } from '../../apiClient';
import type { Settings } from '../../hooks/useSettingsStore';
import {
  getModelOptionsForProvider,
  getPromptOptions,
  getTaskSelectionLabel,
  mapTaskToProviderKey,
  type TaskKey,
  type TaskPromptsState,
} from './legacyWorkspacePromptHelpers';
import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';

const TASKS: TaskKey[] = ['icpDiscovery', 'hypothesisGen', 'emailDraft', 'linkedinMsg'];

type LegacyPromptTaskConfigProps = {
  colors: LegacyWorkspaceColors;
  llmModels: Record<string, string[] | undefined>;
  promptEntries: PromptEntry[];
  promptLoading: boolean;
  settings: Settings;
  taskLabels: Record<TaskKey, string>;
  taskPrompts: TaskPromptsState;
  title: string;
  providerLabel: string;
  modelLabel: string;
  promptLabel: string;
  onModelChange: (task: TaskKey, model: string) => void;
  onPromptChange: (task: TaskKey, promptId?: string) => void;
  onProviderChange: (task: TaskKey, provider: string, nextModel: string) => void;
};

export function LegacyPromptTaskConfig({
  colors,
  llmModels,
  promptEntries,
  promptLoading,
  settings,
  taskLabels,
  taskPrompts,
  title,
  providerLabel,
  modelLabel,
  promptLabel,
  onModelChange,
  onPromptChange,
  onProviderChange,
}: LegacyPromptTaskConfigProps) {
  const promptOptions = getPromptOptions(promptEntries);
  const selectDisabled = promptOptions.length === 0 || promptLoading;

  return (
    <div
      style={{
        marginBottom: '32px',
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        padding: '24px',
      }}
    >
      <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>{title}</h3>
      <div style={{ display: 'grid', gap: '20px' }}>
        {TASKS.map((task) => {
          const providerKey = mapTaskToProviderKey(task);
          const providerCfg = settings.providers[providerKey];
          const modelOptions = getModelOptionsForProvider(providerCfg.provider, llmModels);
          const effectiveModel =
            modelOptions.find((option) => option.value === providerCfg.model)?.value ??
            modelOptions[0]?.value ??
            '';
          const activeId = getTaskSelectionLabel(taskPrompts, task) ?? '';

          return (
            <div key={task}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  marginBottom: '10px',
                  color: colors.text,
                }}
              >
                {taskLabels[task]}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '12px',
                  marginBottom: '6px',
                }}
              >
                <ConfigHeader colors={colors} label={providerLabel} />
                <ConfigHeader colors={colors} label={modelLabel} />
                <ConfigHeader colors={colors} label={promptLabel} />
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '12px',
                }}
              >
                <select
                  value={providerCfg.provider}
                  onChange={(event) => {
                    const nextProvider = event.target.value;
                    const nextOptions = getModelOptionsForProvider(nextProvider, llmModels);
                    const nextModel =
                      nextOptions.find((option) => option.value === providerCfg.model)?.value ??
                      nextOptions[0]?.value ??
                      '';
                    onProviderChange(task, nextProvider, nextModel);
                  }}
                  style={selectStyle(colors)}
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="gemini">Gemini</option>
                </select>

                <select
                  value={effectiveModel}
                  onChange={(event) => onModelChange(task, event.target.value)}
                  style={selectStyle(colors, !modelOptions.length)}
                  disabled={!modelOptions.length}
                >
                  {modelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  disabled={selectDisabled}
                  value={activeId}
                  onChange={(event) => onPromptChange(task, event.target.value || undefined)}
                  style={selectStyle(colors, selectDisabled)}
                >
                  <option value="">
                    {promptOptions.length ? 'Select prompt...' : 'No prompts available'}
                  </option>
                  {promptOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  marginTop: '6px',
                  fontSize: '12px',
                  color: colors.textMuted,
                }}
              >
                Active prompt: {activeId || 'None set'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConfigHeader({
  colors,
  label,
}: {
  colors: LegacyWorkspaceColors;
  label: string;
}) {
  return (
    <div
      style={{
        fontSize: '12px',
        fontWeight: 600,
        color: colors.textMuted,
        paddingLeft: '4px',
      }}
    >
      {label}
    </div>
  );
}

function selectStyle(colors: LegacyWorkspaceColors, disabled = false) {
  return {
    background: colors.sidebar,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '14px',
    color: colors.text,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

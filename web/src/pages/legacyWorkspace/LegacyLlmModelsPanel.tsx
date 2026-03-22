import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';

type ProviderName = 'openai' | 'anthropic';

type LegacyLlmModelsPanelProps = {
  colors: LegacyWorkspaceColors & { error: string };
  llmModels: Record<string, string[] | undefined>;
  llmModelsError: Record<string, string | undefined>;
};

const PROVIDERS: Array<{ key: ProviderName; label: string }> = [
  { key: 'openai', label: 'OpenAI' },
  { key: 'anthropic', label: 'Anthropic' },
];

export function LegacyLlmModelsPanel({
  colors,
  llmModels,
  llmModelsError,
}: LegacyLlmModelsPanelProps) {
  return (
    <div
      style={{
        marginBottom: '24px',
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        padding: '16px 20px',
      }}
    >
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
        Live LLM models (via provider APIs)
      </h3>
      <div style={{ fontSize: '12px', color: colors.textMuted, marginBottom: '8px' }}>
        Lists are fetched from each provider&apos;s `/models` endpoint using your configured API keys.
      </div>

      {PROVIDERS.map((provider) => {
        const models = llmModels[provider.key] ?? [];
        const error = llmModelsError[provider.key];

        return (
          <div key={provider.key} style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
              {provider.label}
            </div>
            {error ? (
              <div style={{ fontSize: '12px', color: colors.error }}>
                Failed to list models: {error}
              </div>
            ) : models.length ? (
              <div
                style={{
                  fontSize: '12px',
                  color: colors.textMuted,
                  maxHeight: '120px',
                  overflow: 'auto',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  padding: '8px 10px',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {models.join(', ')}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: colors.textMuted }}>Loading…</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

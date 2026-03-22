import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';

type LegacyPromptRegistryApiInfoProps = {
  colors: LegacyWorkspaceColors & {
    success: string;
    warning: string;
  };
};

const API_ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/prompt-registry',
    description: 'List all prompts (filter by step)',
    colorKey: 'success',
  },
  {
    method: 'POST',
    path: '/api/prompt-registry',
    description: 'Create new prompt entry',
    colorKey: 'warning',
  },
  {
    method: 'GET',
    path: '/api/prompt-registry/active',
    description: 'Get active prompt for step',
    colorKey: 'success',
  },
  {
    method: 'POST',
    path: '/api/prompt-registry/active',
    description: 'Set active prompt for step',
    colorKey: 'warning',
  },
] as const;

export function LegacyPromptRegistryApiInfo({
  colors,
}: LegacyPromptRegistryApiInfoProps) {
  return (
    <div
      style={{
        marginTop: '32px',
        background: colors.sidebar,
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        padding: '24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Available API Endpoints</h3>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: colors.orange,
            background: colors.orangeLight,
            padding: '2px 8px',
            borderRadius: '4px',
          }}
        >
          COMING SOON
        </span>
      </div>
      <div style={{ display: 'grid', gap: '12px', fontSize: '13px', color: colors.textMuted }}>
        {API_ENDPOINTS.map((endpoint) => (
          <div key={`${endpoint.method}-${endpoint.path}`} style={{ display: 'flex', gap: '12px' }}>
            <span
              style={{
                fontWeight: 600,
                color: colors[endpoint.colorKey],
                fontFamily: 'monospace',
              }}
            >
              {endpoint.method}
            </span>
            <span style={{ fontFamily: 'monospace' }}>{endpoint.path}</span>
            <span>— {endpoint.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

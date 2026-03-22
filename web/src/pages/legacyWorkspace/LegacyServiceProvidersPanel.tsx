import type { ServiceConfig } from '../../apiClient';
import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';

type ServicesCopy = {
  categories: Record<ServiceConfig['category'], string>;
};

type LegacyServiceProvidersPanelProps = {
  colors: LegacyWorkspaceColors;
  isDark: boolean;
  services: ServiceConfig[];
  servicesCopy: ServicesCopy;
};

export function LegacyServiceProvidersPanel({
  colors,
  isDark,
  services,
  servicesCopy,
}: LegacyServiceProvidersPanelProps) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <h4 style={{ fontSize: '16px', fontWeight: 600 }}>Service Providers</h4>
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

      <div style={{ display: 'grid', gap: '8px' }}>
        {services.map((service) => {
          const statusIcon =
            service.status === 'connected' ? '🟢' : service.status === 'warning' ? '🟡' : '🔴';

          return (
            <div
              key={service.name}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: colors.sidebar,
                borderRadius: '8px',
                border: `1px solid ${colors.border}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <span style={{ fontSize: '14px' }}>{statusIcon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{service.name}</div>
                  <div style={{ fontSize: '11px', color: colors.textMuted }}>
                    {servicesCopy.categories[service.category] ?? service.category}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {service.hasApiKey ? (
                  <>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#22c55e',
                        background: isDark
                          ? 'rgba(34, 197, 94, 0.15)'
                          : 'rgba(34, 197, 94, 0.2)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ✓ in .env
                    </span>
                    <label
                      style={{
                        position: 'relative',
                        display: 'inline-block',
                        width: '44px',
                        height: '24px',
                        cursor: 'not-allowed',
                        opacity: 0.5,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={service.status === 'connected'}
                        disabled
                        readOnly
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          cursor: 'not-allowed',
                          inset: 0,
                          background:
                            service.status === 'connected' ? '#22c55e' : colors.border,
                          borderRadius: '24px',
                          transition: 'background 0.3s',
                        }}
                      ></span>
                      <span
                        style={{
                          position: 'absolute',
                          left: service.status === 'connected' ? '22px' : '2px',
                          top: '2px',
                          width: '20px',
                          height: '20px',
                          background: '#FFF',
                          borderRadius: '50%',
                          transition: 'left 0.3s',
                        }}
                      ></span>
                    </label>
                  </>
                ) : (
                  <>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#ef4444',
                        background: isDark
                          ? 'rgba(239, 68, 68, 0.15)'
                          : 'rgba(239, 68, 68, 0.2)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ⚠️ missing
                    </span>
                    <button
                      disabled
                      style={{
                        background: colors.orangeLight,
                        border: `1px solid ${colors.orange}`,
                        color: colors.orange,
                        padding: '6px 16px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'not-allowed',
                        opacity: 0.6,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Set up
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

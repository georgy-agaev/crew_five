import type { ServiceConfig } from '../../apiClient';
import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';

type ServicesCopy = {
  categories: Record<ServiceConfig['category'], string>;
};

type LegacyWorkspaceServicesModalProps = {
  colors: LegacyWorkspaceColors;
  services: ServiceConfig[];
  servicesCopy: ServicesCopy;
  title: string;
  onClose: () => void;
};

export function LegacyWorkspaceServicesModal({
  colors,
  services,
  servicesCopy,
  title,
  onClose,
}: LegacyWorkspaceServicesModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: colors.card,
          borderRadius: '16px',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '24px', borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700 }}>{title}</h3>
            <button
              onClick={onClose}
              style={closeButtonStyle(colors)}
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gap: '12px' }}>
            {services.map((service) => {
              const statusColor =
                service.status === 'connected'
                  ? colors.success
                  : service.status === 'warning'
                    ? colors.warning
                    : colors.error;

              return (
                <div
                  key={service.name}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    background: colors.sidebar,
                    borderRadius: '8px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{service.name}</div>
                    <div style={{ fontSize: '12px', color: colors.textMuted }}>
                      {servicesCopy.categories[service.category] ?? service.category}
                    </div>
                  </div>
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: statusColor,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function closeButtonStyle(colors: LegacyWorkspaceColors) {
  return {
    background: 'none',
    border: 'none',
    color: colors.textMuted,
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0',
    width: '32px',
    height: '32px',
  } as const;
}

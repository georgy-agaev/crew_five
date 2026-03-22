import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';
import { fieldStyle, primaryButtonStyle } from './legacyWorkspaceStepStyles';

type IcpProfileRow = {
  id: string;
  name?: string | null;
  company_count?: number | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type LegacyIcpStepProps = {
  aiLoading: boolean;
  colors: LegacyWorkspaceColors;
  companiesLabel: string;
  copy: {
    title: string;
    subtitle: string;
    chooseExisting: string;
    createNew: string;
    updated: string;
    aiTitle: string;
    aiDesc: string;
    quickEntry: string;
    quickDesc: string;
  };
  icpProfiles: IcpProfileRow[];
  newIcpDescription: string;
  newIcpName: string;
  selectedIcpId: string | null;
  onCreateQuick: () => void | Promise<void>;
  onDescriptionChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onOpenAiChat: () => void;
  onSelectIcp: (profile: IcpProfileRow) => void;
};

export function LegacyIcpStep({
  aiLoading,
  colors,
  companiesLabel,
  copy,
  icpProfiles,
  newIcpDescription,
  newIcpName,
  selectedIcpId,
  onCreateQuick,
  onDescriptionChange,
  onNameChange,
  onOpenAiChat,
  onSelectIcp,
}: LegacyIcpStepProps) {
  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>{copy.title}</h2>
        <p style={{ fontSize: '14px', color: colors.textMuted, lineHeight: '1.6' }}>
          {copy.subtitle}
        </p>
      </div>

      <div style={{ display: 'grid', gap: '24px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
            {copy.chooseExisting}
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            {icpProfiles.map((profile) => {
              const companies = profile.company_count ?? 0;
              const updatedRaw = profile.updated_at ?? profile.created_at ?? '';
              const updated = typeof updatedRaw === 'string' && updatedRaw ? updatedRaw : '';
              const isSelected = selectedIcpId === profile.id;

              return (
                <button
                  key={profile.id}
                  onClick={() => onSelectIcp(profile)}
                  style={profileCardStyle(colors, isSelected)}
                >
                  <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>
                    {profile.name ?? profile.id}
                  </div>
                  <div style={{ fontSize: '13px', color: colors.textMuted }}>
                    {companies.toLocaleString()} {companiesLabel}
                    {updated ? ` • ${copy.updated}: ${updated}` : ''}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
            {copy.createNew}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <ActionCard
              colors={colors}
              title={copy.aiTitle}
              description={copy.aiDesc}
              onClick={onOpenAiChat}
            />
            <ActionCard
              colors={colors}
              title={copy.quickEntry}
              description={copy.quickDesc}
              onClick={() => undefined}
            />
          </div>
          <div style={{ marginTop: '12px', display: 'grid', gap: '8px' }}>
            <input
              placeholder="ICP name"
              value={newIcpName}
              onChange={(event) => onNameChange(event.target.value)}
              style={fieldStyle(colors)}
            />
            <textarea
              placeholder="Optional description"
              value={newIcpDescription}
              onChange={(event) => onDescriptionChange(event.target.value)}
              rows={2}
              style={fieldStyle(colors)}
            />
            <button
              onClick={() => void onCreateQuick()}
              disabled={aiLoading}
              style={{
                ...primaryButtonStyle(colors, aiLoading, '10px 16px'),
                marginTop: '4px',
              }}
            >
              Save ICP
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  colors,
  title,
  description,
  onClick,
}: {
  colors: LegacyWorkspaceColors;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={actionCardStyle(colors)}>
      <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>
        {title}
      </div>
      <div style={{ fontSize: '13px', color: colors.textMuted, lineHeight: '1.5' }}>
        {description}
      </div>
    </button>
  );
}

function profileCardStyle(colors: LegacyWorkspaceColors, selected: boolean) {
  return {
    background: colors.card,
    border: `1px solid ${selected ? colors.orange : colors.border}`,
    borderRadius: '8px',
    padding: '16px',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } as const;
}

function actionCardStyle(colors: LegacyWorkspaceColors) {
  return {
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    padding: '20px',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } as const;
}

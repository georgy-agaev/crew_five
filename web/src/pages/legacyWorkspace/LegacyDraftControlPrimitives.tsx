import type { ReactNode } from 'react';

import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';
import { labelStyle } from './legacyWorkspaceStepStyles';

export function ModeToggle<T extends string>({
  colors,
  label,
  value,
  options,
  onChange,
}: {
  colors: LegacyWorkspaceColors;
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ ...labelStyle(colors), marginBottom: '8px' }}>{label}</div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {options.map((option) => (
          <ToggleButton
            key={option.value}
            active={value === option.value}
            colors={colors}
            label={option.label}
            onClick={() => onChange(option.value)}
          />
        ))}
      </div>
    </div>
  );
}

export function ToggleButton({
  active,
  colors,
  label,
  onClick,
}: {
  active: boolean;
  colors: LegacyWorkspaceColors;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '8px 10px',
        borderRadius: '8px',
        border: `1px solid ${active ? colors.orange : colors.border}`,
        background: active ? colors.orangeLight : colors.card,
        color: active ? colors.orange : colors.textMuted,
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

export function LabeledField({
  children,
  colors,
  label,
}: {
  children: ReactNode;
  colors: LegacyWorkspaceColors;
  label: string;
}) {
  return (
    <div>
      <div style={labelStyle(colors)}>{label}</div>
      {children}
    </div>
  );
}

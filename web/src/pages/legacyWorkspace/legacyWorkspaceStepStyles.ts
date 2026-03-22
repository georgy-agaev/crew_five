import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';

export function sectionTitleStyle(colors: LegacyWorkspaceColors) {
  return { fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: colors.text } as const;
}

export function labelStyle(colors: LegacyWorkspaceColors) {
  return {
    fontSize: '12px',
    fontWeight: 600,
    color: colors.textMuted,
    marginBottom: '4px',
  } as const;
}

export function fieldStyle(colors: LegacyWorkspaceColors) {
  return {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
    background: colors.card,
    fontSize: '14px',
  };
}

export function primaryButtonStyle(
  colors: LegacyWorkspaceColors,
  disabled: boolean,
  padding = '12px 24px'
) {
  return {
    background: colors.orange,
    color: '#FFF',
    border: 'none',
    borderRadius: '8px',
    padding,
    fontSize: '14px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.7 : 1,
    transition: 'all 0.2s ease',
  } as const;
}

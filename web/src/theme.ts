export interface WorkspaceColors {
  bg: string;
  card: string;
  cardHover: string;
  text: string;
  textMuted: string;
  border: string;
  orange: string;
  orangeLight: string;
  sidebar: string;
  navSidebar: string;
  pattern: string;
  success: string;
  warning: string;
  error: string;
}

export const lightWorkspaceColors: WorkspaceColors = {
  bg: '#FAFAFA',
  card: '#FFFFFF',
  cardHover: '#FEFEFE',
  text: '#1A1A1A',
  textMuted: '#6B6B6B',
  border: '#E5E5E5',
  orange: '#FF6B35',
  orangeLight: '#FFF4F0',
  sidebar: '#F5F5F5',
  navSidebar: '#F0F0F0',
  pattern: '#E8E8E8',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
};

export const darkWorkspaceColors: WorkspaceColors = {
  bg: '#0A0A0A',
  card: '#161616',
  cardHover: '#1E1E1E',
  text: '#FAFAFA',
  textMuted: '#A0A0A0',
  border: '#2A2A2A',
  orange: '#FF8A5B',
  orangeLight: '#2A1810',
  sidebar: '#0D0D0D',
  navSidebar: '#080808',
  pattern: '#1A1A1A',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
};

export function getWorkspaceColors(isDark: boolean): WorkspaceColors {
  return isDark ? darkWorkspaceColors : lightWorkspaceColors;
}


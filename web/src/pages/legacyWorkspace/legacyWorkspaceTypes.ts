export type LegacyWorkspacePage =
  | 'pipeline'
  | 'campaigns'
  | 'inbox'
  | 'analytics'
  | 'promptRegistry';

export type LegacyWorkspaceColors = {
  bg: string;
  text: string;
  textMuted: string;
  border: string;
  navSidebar: string;
  sidebar: string;
  card: string;
  cardHover: string;
  orange: string;
  orangeLight: string;
  success: string;
  warning: string;
  error: string;
};

export type LegacyWorkspaceNavItem = {
  page: LegacyWorkspacePage;
  label: string;
  short: string;
  title: string;
};

export type LegacyWorkspaceParallelLink = {
  href: string;
  label: string;
  short: string;
  title: string;
};

export type LegacyWorkspaceLanguage = {
  code: string;
  label: string;
  name: string;
};

export type LegacyWorkspaceService = {
  category: string;
  hasApiKey: boolean;
};

export type PromptRegistryFilterStatus = 'all' | 'active' | 'pilot' | 'retired';

export type PromptRegistryCreateFormState = {
  id: string;
  step?: string;
  version: string;
  description: string;
  rollout_status: 'pilot' | 'active' | 'retired' | 'deprecated';
  prompt_text: string;
};

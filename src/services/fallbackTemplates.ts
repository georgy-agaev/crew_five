const catalog: Record<string, Record<string, string>> = {
  general: {
    en: 'Default fallback body',
  },
};

export function getFallbackTemplate(category: string, locale: string) {
  return catalog[category]?.[locale] ?? null;
}

export function applyGracefulFallback(
  draftInput: { subject?: string | null; body?: string | null },
  template: string
) {
  const subject = draftInput.subject ?? 'Fallback Subject';
  const body = draftInput.body ?? template;
  return { ...draftInput, subject, body };
}

export function ensureGracefulToggle(hasCatalog: boolean) {
  if (!hasCatalog) {
    throw new Error('Graceful mode requires a fallback template catalog');
  }
}

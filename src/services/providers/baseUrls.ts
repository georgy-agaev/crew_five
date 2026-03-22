export function normalizeOpenAiBaseUrl(input?: string): string {
  const raw = (input && input.trim()) || 'https://api.openai.com/v1';
  const withoutTrailing = raw.replace(/\/+$/, '');
  // If the base already ends with a version segment like /v1 or /v1beta, keep it as-is.
  if (/(\/v[0-9][^/]*)$/.test(withoutTrailing)) {
    return withoutTrailing;
  }
  // Otherwise, default to /v1 which is where OpenAI exposes /models and /chat/completions.
  return `${withoutTrailing}/v1`;
}

export function normalizeAnthropicBaseUrl(input?: string): string {
  const raw = (input && input.trim()) || 'https://api.anthropic.com/v1';
  const withoutTrailing = raw.replace(/\/+$/, '');
  if (/(\/v[0-9][^/]*)$/.test(withoutTrailing)) {
    return withoutTrailing;
  }
  return `${withoutTrailing}/v1`;
}


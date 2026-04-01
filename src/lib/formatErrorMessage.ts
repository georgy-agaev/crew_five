export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const candidate = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
      error?: unknown;
    };
    const parts = [
      typeof candidate.message === 'string' ? candidate.message : null,
      typeof candidate.details === 'string' ? candidate.details : null,
      typeof candidate.hint === 'string' ? candidate.hint : null,
      typeof candidate.code === 'string' ? `code=${candidate.code}` : null,
      typeof candidate.error === 'string' ? candidate.error : null,
    ].filter((value): value is string => Boolean(value && value.trim()));

    if (parts.length > 0) {
      return parts.join(' | ');
    }

    try {
      return JSON.stringify(error);
    } catch {
      return '[unserializable error object]';
    }
  }

  return String(error);
}


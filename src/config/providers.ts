export interface ParallelEnvConfig {
  apiKey: string;
  baseUrl: string;
}

export interface FirecrawlEnvConfig {
  apiKey: string;
  baseUrl: string;
}

export interface AnySiteEnvConfig {
  apiKey: string;
  baseUrl: string;
}

export function loadParallelEnv(): ParallelEnvConfig {
  const apiKey = process.env.PARALLEL_API_KEY;

  if (!apiKey) {
    throw new Error(
      'PARALLEL_API_KEY is required. Set it in your environment or .env file.',
    );
  }

  const baseUrl = process.env.PARALLEL_API_BASE || 'https://api.parallel.ai';

  return {
    apiKey,
    baseUrl,
  };
}

export function loadFirecrawlEnv(): FirecrawlEnvConfig {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    throw new Error(
      'FIRECRAWL_API_KEY is required. Set it in your environment or .env file.',
    );
  }

  const baseUrl =
    process.env.FIRECRAWL_API_BASE || 'https://api.firecrawl.dev';

  return {
    apiKey,
    baseUrl,
  };
}

export function loadAnySiteEnv(): AnySiteEnvConfig {
  const apiKey = process.env.ANYSITE_API_KEY;

  if (!apiKey) {
    throw new Error(
      'ANYSITE_API_KEY is required. Set it in your environment or .env file.',
    );
  }

  const baseUrl =
    process.env.ANYSITE_API_BASE || 'https://api.anysite.io';

  return {
    apiKey,
    baseUrl,
  };
}

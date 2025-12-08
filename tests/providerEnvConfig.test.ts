import { beforeEach, describe, expect, it } from 'vitest';

import { loadAnySiteEnv, loadFirecrawlEnv, loadParallelEnv } from '../src/config/providers';

describe('provider env config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PARALLEL_API_KEY;
    delete process.env.PARALLEL_API_BASE;
    delete process.env.FIRECRAWL_API_KEY;
    delete process.env.FIRECRAWL_API_BASE;
    delete process.env.ANYSITE_API_KEY;
    delete process.env.ANYSITE_API_BASE;
  });

  describe('loadParallelEnv', () => {
    it('throws a helpful error when PARALLEL_API_KEY is missing', () => {
      expect(() => loadParallelEnv()).toThrow(/PARALLEL_API_KEY/);
    });

    it('returns config with default base URL when only key is set', () => {
      process.env.PARALLEL_API_KEY = 'test-parallel-key';

      const config = loadParallelEnv();

      expect(config.apiKey).toBe('test-parallel-key');
      expect(config.baseUrl).toBe('https://api.parallel.ai');
    });

    it('honours PARALLEL_API_BASE override when provided', () => {
      process.env.PARALLEL_API_KEY = 'test-parallel-key';
      process.env.PARALLEL_API_BASE = 'https://parallel.example.com';

      const config = loadParallelEnv();

      expect(config.baseUrl).toBe('https://parallel.example.com');
    });
  });

  describe('loadFirecrawlEnv', () => {
    it('throws a helpful error when FIRECRAWL_API_KEY is missing', () => {
      expect(() => loadFirecrawlEnv()).toThrow(/FIRECRAWL_API_KEY/);
    });

    it('returns config with default base URL when only key is set', () => {
      process.env.FIRECRAWL_API_KEY = 'test-firecrawl-key';

      const config = loadFirecrawlEnv();

      expect(config.apiKey).toBe('test-firecrawl-key');
      expect(config.baseUrl).toBe('https://api.firecrawl.dev');
    });

    it('honours FIRECRAWL_API_BASE override when provided', () => {
      process.env.FIRECRAWL_API_KEY = 'test-firecrawl-key';
      process.env.FIRECRAWL_API_BASE = 'https://firecrawl.example.com';

      const config = loadFirecrawlEnv();

      expect(config.baseUrl).toBe('https://firecrawl.example.com');
    });
  });

  describe('loadAnySiteEnv', () => {
    it('throws a helpful error when ANYSITE_API_KEY is missing', () => {
      expect(() => loadAnySiteEnv()).toThrow(/ANYSITE_API_KEY/);
    });

    it('returns config with default base URL when only key is set', () => {
      process.env.ANYSITE_API_KEY = 'test-anysite-key';

      const config = loadAnySiteEnv();

      expect(config.apiKey).toBe('test-anysite-key');
      expect(config.baseUrl).toBe('https://api.anysite.io');
    });

    it('honours ANYSITE_API_BASE override when provided', () => {
      process.env.ANYSITE_API_KEY = 'test-anysite-key';
      process.env.ANYSITE_API_BASE = 'https://anysite.example.com';

      const config = loadAnySiteEnv();

      expect(config.baseUrl).toBe('https://anysite.example.com');
    });
  });
});

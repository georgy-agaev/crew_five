import type { ParallelEnvConfig } from '../config/providers.js';
import { loadParallelEnv } from '../config/providers.js';

export interface ParallelClient {
  researchCompany(input: {
    companyName: string;
    website?: string | null;
    country?: string | null;
  }): Promise<unknown>;
  researchContact(input: {
    fullName: string;
    companyName?: string | null;
    role?: string | null;
    linkedinUrl?: string | null;
    website?: string | null;
  }): Promise<unknown>;
}

export function buildParallelClientFromEnv(
  envLoader: () => ParallelEnvConfig = loadParallelEnv
): ParallelClient {
  const config = envLoader();

  const client: ParallelClient = {
    async researchCompany(input) {
      const name = input.companyName ?? 'Unknown company';
      const website = input.website ?? null;
      const country = input.country ?? null;

      const sources =
        website != null
          ? [
              {
                url: website,
                title: `Parallel.ai stub source for ${name}`,
              },
            ]
          : [];

      return {
        provider: 'parallel',
        summary: `Parallel.ai stub research for ${name}${country ? ` in ${country}` : ''}.`,
        sources,
      };
    },
    async researchContact(input) {
      const fullName = input.fullName ?? 'Unknown contact';
      const role = input.role ?? null;
      const companyName = input.companyName ?? null;

      return {
        provider: 'parallel',
        summary: `Parallel.ai stub research for ${fullName}${
          role ? ` (${role})` : ''
        }${companyName ? ` at ${companyName}` : ''}.`,
        sources: [],
      };
    },
  };

  // Touch config so unused-variable checks stay quiet and document shape.
  void config;

  return client;
}

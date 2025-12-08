import type { ParallelEnvConfig } from '../config/providers';
import { loadParallelEnv } from '../config/providers';

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
    async researchCompany() {
      throw new Error(
        'Parallel.ai enrichment client is not wired yet; use Exa enrichment for now.'
      );
    },
    async researchContact() {
      throw new Error(
        'Parallel.ai enrichment client is not wired yet; use Exa enrichment for now.'
      );
    },
  };

  // Touch config so unused-variable checks stay quiet and document shape.
  void config;

  return client;
}


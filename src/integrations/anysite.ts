import type { AnySiteEnvConfig } from '../config/providers.js';
import { loadAnySiteEnv } from '../config/providers.js';

export interface AnySiteClient {
  lookupProfile(input: {
    url: string;
  }): Promise<unknown>;
}

export function buildAnySiteClientFromEnv(
  envLoader: () => AnySiteEnvConfig = loadAnySiteEnv
): AnySiteClient {
  const config = envLoader();

  const client: AnySiteClient = {
    async lookupProfile() {
      throw new Error(
        'Anysite.io client is shape-only for now; enrichment routing will be wired in a later phase.'
      );
    },
  };

  void config;

  return client;
}

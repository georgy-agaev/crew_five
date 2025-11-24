export interface EnrichmentAdapter {
  fetchCompanyInsights(input: { company_id: string }): Promise<Record<string, unknown>>;
  fetchEmployeeInsights(input: { contact_id: string }): Promise<Record<string, unknown>>;
}

class MockAdapter implements EnrichmentAdapter {
  async fetchCompanyInsights(input: { company_id: string }) {
    return { company_id: input.company_id, insight: 'mock-company' };
  }
  async fetchEmployeeInsights(input: { contact_id: string }) {
    return { contact_id: input.contact_id, insight: 'mock-employee' };
  }
}

const adapters: Record<string, EnrichmentAdapter> = {
  mock: new MockAdapter(),
};

export function getEnrichmentAdapter(name: string): EnrichmentAdapter {
  const adapter = adapters[name];
  if (!adapter) {
    throw new Error(`Unknown enrichment adapter: ${name}`);
  }
  return adapter;
}

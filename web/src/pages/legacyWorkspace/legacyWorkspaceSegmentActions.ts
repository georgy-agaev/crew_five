type FilterRule = {
  field: string;
  operator: string;
  value: unknown;
};

type ExaCompany = Record<string, unknown>;
type ExaEmployee = Record<string, unknown>;
type SegmentRow = Record<string, unknown>;

type ManualSegmentInput = {
  name: string;
  filterDefinition: FilterRule[];
};

type ExaSegmentInput = {
  name: string;
  companies: ExaCompany[];
  employees: ExaEmployee[];
  query: string;
};

type CreateSegmentDeps = {
  createSegmentApi: (input: {
    name: string;
    locale: string;
    filterDefinition: FilterRule[];
  }) => Promise<unknown>;
  fetchSegmentsApi: () => Promise<SegmentRow[]>;
};

type SaveExaSegmentDeps = {
  saveExaSegmentApi: (input: {
    name: string;
    locale: string;
    companies: ExaCompany[];
    employees: ExaEmployee[];
    query: string;
    description: string;
  }) => Promise<unknown>;
  fetchSegmentsApi: () => Promise<SegmentRow[]>;
};

export async function createSegmentAndRefresh(
  segment: ManualSegmentInput,
  deps: CreateSegmentDeps
) {
  await deps.createSegmentApi({
    name: segment.name,
    locale: 'en',
    filterDefinition: segment.filterDefinition,
  });

  return deps.fetchSegmentsApi();
}

export async function saveExaSegmentAndRefresh(
  segment: ExaSegmentInput,
  language: string,
  deps: SaveExaSegmentDeps
) {
  await deps.saveExaSegmentApi({
    name: segment.name,
    locale: language,
    companies: segment.companies,
    employees: segment.employees,
    query: segment.query,
    description: `EXA Web Search: ${segment.query}`,
  });

  return deps.fetchSegmentsApi();
}

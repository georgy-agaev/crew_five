import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeEmployeeNameParts } from './employeeNameRepair';
import { recordEmployeeDataRepair } from './employeeDataRepairs';

type ImportAction = 'create' | 'update' | 'skip';

export interface CompanyImportEmployeeInput {
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  position?: string | null;
  work_email?: string | null;
  generic_email?: string | null;
  source_urls?: string[] | null;
  phone_numbers?: string[] | null;
  ai_research_data?: unknown;
  source_service?: string | null;
  processing_status?: string | null;
}

export interface CompanyImportInput {
  company_name: string;
  tin?: string | null;
  registration_number?: string | null;
  registration_date?: string | null;
  region?: string | null;
  status?: string | null;
  website?: string | null;
  ceo_name?: string | null;
  ceo_position?: string | null;
  primary_email?: string | null;
  employee_count?: number | null;
  source?: string | null;
  segment?: string | null;
  company_description?: string | null;
  office_qualification?: string | null;
  all_company_emails?: string[] | null;
  company_research?: unknown;
  batch_id?: string | null;
  processing_status?: string | null;
  workflow_execution_id?: string | null;
  revenue?: number | null;
  balance?: number | null;
  net_profit_loss?: number | null;
  sme_registry?: string | null;
  country_code?: string | null;
  country_source?: string | null;
  employees?: CompanyImportEmployeeInput[];
}

export interface CompanySaveProcessedPayload {
  company: CompanyImportInput;
  employees?: CompanyImportEmployeeInput[];
}

export interface CompanySaveProcessedResult {
  company_id: string;
  employee_ids: string[];
  warnings: string[];
  company_action: Extract<ImportAction, 'create' | 'update'>;
  employee_created_count: number;
  employee_updated_count: number;
}

export interface CompanyImportPreviewItem {
  company_name: string;
  tin: string | null;
  action: ImportAction;
  match_field?: 'tin' | 'registration_number' | null;
  office_qualification: 'More' | 'Less' | null;
  warnings: string[];
}

export interface CompanyImportResult {
  mode: 'dry-run' | 'apply';
  summary: {
    total_count: number;
    created_count: number;
    updated_count: number;
    skipped_count: number;
    employee_created_count: number;
    employee_updated_count: number;
  };
  items: CompanyImportPreviewItem[];
  applied?: Array<{
    index: number;
    company_id: string;
    action: Extract<ImportAction, 'create' | 'update'>;
  }>;
}

interface NormalizedCompanyImportInput extends Omit<CompanyImportInput, 'employees'> {
  company_name: string;
  tin?: string | null;
  registration_number?: string | null;
  office_qualification?: 'More' | 'Less' | null;
  employees: CompanyImportEmployeeInput[];
}

interface EmployeeLookupOptions {
  preferCompanyScopedName: boolean;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  return normalizeString(value);
}

function normalizeEmail(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : null;
}

function normalizeOptionalEmail(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  return normalizeEmail(value);
}

function normalizeJsonValue(value: unknown): unknown {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return normalizeString(value);
  }
  if (typeof value === 'object') {
    return value;
  }
  return value;
}

function normalizeOptionalJsonValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  return normalizeJsonValue(value);
}

function normalizeOptionalStringArray(value: unknown): string[] | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Array.isArray(value)) return null;
  const normalized = value
    .map((item) => normalizeString(item))
    .filter((item): item is string => item !== null);
  return normalized;
}

function normalizeOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeOptionalCountryCode(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  const normalized = normalizeString(value);
  return normalized ? normalized.toUpperCase() : null;
}

function isValidEmail(value: string | null): boolean {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value);
}

function normalizeOfficeQualification(
  officeQualification: unknown,
  employeeCount: unknown
): 'More' | 'Less' | null | undefined {
  if (officeQualification === undefined && employeeCount === undefined) {
    return undefined;
  }
  if (officeQualification === 'More' || officeQualification === 'Less') {
    return officeQualification;
  }
  if (typeof employeeCount === 'number' && Number.isFinite(employeeCount)) {
    return employeeCount >= 50 ? 'More' : 'Less';
  }
  return null;
}

function normalizeCompanyInput(input: CompanyImportInput): NormalizedCompanyImportInput {
  return {
    ...input,
    company_name: normalizeString(input.company_name) ?? '',
    tin: normalizeOptionalString(input.tin),
    registration_number: normalizeOptionalString(input.registration_number),
    registration_date: normalizeOptionalString(input.registration_date),
    region: normalizeOptionalString(input.region),
    status: normalizeOptionalString(input.status),
    website: normalizeOptionalString(input.website),
    ceo_name: normalizeOptionalString(input.ceo_name),
    ceo_position: normalizeOptionalString(input.ceo_position),
    primary_email: normalizeOptionalEmail(input.primary_email),
    employee_count: normalizeOptionalNumber(input.employee_count),
    source: normalizeOptionalString(input.source),
    segment: normalizeOptionalString(input.segment),
    company_description: normalizeOptionalString(input.company_description),
    office_qualification: normalizeOfficeQualification(input.office_qualification, input.employee_count),
    company_research: normalizeOptionalJsonValue(input.company_research),
    batch_id: normalizeOptionalString(input.batch_id),
    processing_status: normalizeOptionalString(input.processing_status),
    workflow_execution_id: normalizeOptionalString(input.workflow_execution_id),
    revenue: normalizeOptionalNumber(input.revenue),
    balance: normalizeOptionalNumber(input.balance),
    net_profit_loss: normalizeOptionalNumber(input.net_profit_loss),
    sme_registry: input.sme_registry === undefined ? undefined : input.sme_registry ?? null,
    country_code: normalizeOptionalCountryCode(input.country_code),
    country_source: normalizeOptionalString(input.country_source),
    employees: Array.isArray(input.employees) ? input.employees : [],
  };
}

function validateCompanyInput(input: NormalizedCompanyImportInput): string[] {
  const warnings: string[] = [];
  if (!input.company_name) {
    warnings.push('company_name is required');
  }
  if (input.primary_email && !isValidEmail(input.primary_email)) {
    warnings.push('primary_email is invalid');
  }
  for (const employee of input.employees) {
    if (!normalizeString(employee.full_name)) {
      warnings.push('employee.full_name is required');
    }
    if (!isValidEmail(normalizeEmail(employee.work_email))) {
      warnings.push(`employee.work_email is invalid for ${employee.full_name || 'unknown employee'}`);
    }
    if (!isValidEmail(normalizeEmail(employee.generic_email))) {
      warnings.push(`employee.generic_email is invalid for ${employee.full_name || 'unknown employee'}`);
    }
  }
  return warnings;
}

function listMissingFields(input: NormalizedCompanyImportInput): string[] {
  const missing: string[] = [];
  if (!input.company_name) {
    missing.push('company.company_name');
  }
  input.employees.forEach((employee, index) => {
    if (!normalizeString(employee.full_name)) {
      missing.push(`employees[${index}].full_name`);
    }
  });
  return missing;
}

function listInvalidFields(input: NormalizedCompanyImportInput): string[] {
  const invalid: string[] = [];
  if (input.primary_email && !isValidEmail(input.primary_email)) {
    invalid.push('company.primary_email');
  }
  input.employees.forEach((employee, index) => {
    const workEmail = normalizeEmail(employee.work_email);
    if (workEmail && !isValidEmail(workEmail)) {
      invalid.push(`employees[${index}].work_email`);
    }
    const genericEmail = normalizeEmail(employee.generic_email);
    if (genericEmail && !isValidEmail(genericEmail)) {
      invalid.push(`employees[${index}].generic_email`);
    }
  });
  return invalid;
}

async function findExistingCompany(client: SupabaseClient, input: NormalizedCompanyImportInput) {
  if (input.tin) {
    const { data, error } = await client
      .from('companies')
      .select('id,tin,registration_number')
      .eq('tin', input.tin)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      return {
        ...(data as { id: string; tin?: string | null; registration_number?: string | null }),
        match_field: 'tin' as const,
      };
    }
  }

  if (input.registration_number) {
    const { data, error } = await client
      .from('companies')
      .select('id,tin,registration_number')
      .eq('registration_number', input.registration_number)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      return {
        ...(data as { id: string; tin?: string | null; registration_number?: string | null }),
        match_field: 'registration_number' as const,
      };
    }
  }

  return null;
}

function buildCompanyMatchWarnings(
  input: NormalizedCompanyImportInput,
  existing: { tin?: string | null; match_field: 'tin' | 'registration_number' } | null,
  baseWarnings: string[]
) {
  const warnings = [...baseWarnings];
  if (
    existing?.match_field === 'registration_number' &&
    input.tin &&
    normalizeString(existing.tin) &&
    input.tin !== normalizeString(existing.tin)
  ) {
    warnings.push(`TIN mismatch: file=${input.tin}, db=${normalizeString(existing.tin)}`);
  }
  return warnings;
}

function buildCompanyPatch(input: NormalizedCompanyImportInput) {
  return {
    company_name: input.company_name,
    tin: input.tin,
    registration_number: input.registration_number,
    registration_date: input.registration_date,
    region: input.region,
    status: input.status,
    website: input.website,
    ceo_name: input.ceo_name,
    ceo_position: input.ceo_position,
    primary_email: input.primary_email,
    employee_count: input.employee_count,
    source: input.source,
    segment: input.segment,
    company_description: input.company_description,
    office_qualification: input.office_qualification,
    all_company_emails: input.all_company_emails,
    company_research: input.company_research,
    batch_id: input.batch_id,
    processing_status: input.processing_status,
    workflow_execution_id: input.workflow_execution_id,
    revenue: input.revenue,
    balance: input.balance,
    net_profit_loss: input.net_profit_loss,
    sme_registry: input.sme_registry,
    country_code: input.country_code,
    country_source: input.country_source,
  };
}

function stripUndefined<T extends Record<string, unknown>>(patch: T) {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

async function upsertCompany(client: SupabaseClient, input: NormalizedCompanyImportInput): Promise<{
  id: string;
  action: Extract<ImportAction, 'create' | 'update'>;
}> {
  const existing = await findExistingCompany(client, input);
  const patch = buildCompanyPatch(input);

  if (existing) {
    const { error } = await client.from('companies').update(stripUndefined(patch)).eq('id', existing.id);
    if (error) throw error;
    return { id: existing.id, action: 'update' };
  }

  const createPatch = {
    ...stripUndefined(patch),
    status: patch.status ?? 'Active',
    processing_status: patch.processing_status ?? 'pending',
  };
  const { data, error } = await client.from('companies').insert(createPatch).select('id').single();
  if (error || !data) {
    throw error ?? new Error('Failed to create company');
  }
  return { id: (data as { id: string }).id, action: 'create' };
}

async function findExistingEmployee(
  client: SupabaseClient,
  companyId: string,
  employee: CompanyImportEmployeeInput,
  options: EmployeeLookupOptions
) {
  const employeeTable = client.from('employees');
  const workEmail = normalizeEmail(employee.work_email);
  const genericEmail = normalizeEmail(employee.generic_email);
  const fullName = normalizeString(employee.full_name);

  if (options.preferCompanyScopedName && fullName) {
    const { data, error } = await employeeTable
      .select('id')
      .eq('company_id', companyId)
      .eq('full_name', fullName)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as { id: string };
  }

  if (workEmail) {
    const { data, error } = await employeeTable.select('id').eq('work_email', workEmail).maybeSingle();
    if (error) throw error;
    if (data) return data as { id: string };
  }

  if (genericEmail) {
    const { data, error } = await employeeTable.select('id').eq('generic_email', genericEmail).maybeSingle();
    if (error) throw error;
    if (data) return data as { id: string };
  }

  if (fullName) {
    const { data, error } = await employeeTable
      .select('id')
      .eq('company_id', companyId)
      .eq('full_name', fullName)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as { id: string };
  }

  return null;
}

function buildEmployeePatch(companyId: string, companyName: string, employee: CompanyImportEmployeeInput) {
  return {
    company_id: companyId,
    full_name: normalizeString(employee.full_name) ?? '',
    first_name: normalizeOptionalString(employee.first_name),
    last_name: normalizeOptionalString(employee.last_name),
    middle_name: normalizeOptionalString(employee.middle_name),
    position: normalizeOptionalString(employee.position),
    work_email: normalizeOptionalEmail(employee.work_email),
    generic_email: normalizeOptionalEmail(employee.generic_email),
    source_urls: normalizeOptionalStringArray(employee.source_urls),
    phone_numbers: normalizeOptionalStringArray(employee.phone_numbers),
    ai_research_data: normalizeOptionalJsonValue(employee.ai_research_data),
    source_service: normalizeOptionalString(employee.source_service),
    company_name: companyName,
    processing_status: normalizeOptionalString(employee.processing_status),
  };
}

function normalizeProcessedSaveEmployees(employees: CompanyImportEmployeeInput[]) {
  const warnings: string[] = [];
  const audits: Array<{
    employeeIndex: number;
    audit: NonNullable<ReturnType<typeof normalizeEmployeeNameParts>['audit']>;
  }> = [];
  const normalizedEmployees = employees.map((employee, employeeIndex) => {
    const normalizedNames = normalizeEmployeeNameParts({
      full_name: normalizeString(employee.full_name) ?? '',
      first_name: employee.first_name,
      last_name: employee.last_name,
    });
    warnings.push(...normalizedNames.warnings);
    if (normalizedNames.audit) {
      audits.push({
        employeeIndex,
        audit: normalizedNames.audit,
      });
    }
    return {
      ...employee,
      first_name: normalizedNames.first_name,
      last_name: normalizedNames.last_name,
    };
  });

  return {
    employees: normalizedEmployees,
    warnings,
    audits,
  };
}

async function upsertEmployees(
  client: SupabaseClient,
  companyId: string,
  companyName: string,
  employees: CompanyImportEmployeeInput[],
  options: EmployeeLookupOptions
) {
  let createdCount = 0;
  let updatedCount = 0;
  const employeeIds: string[] = [];

  for (const employee of employees) {
    const patch = buildEmployeePatch(companyId, companyName, employee);
    if (!patch.full_name) {
      continue;
    }

    const existing = await findExistingEmployee(client, companyId, employee, options);
    if (existing) {
      const { data, error } = await client
        .from('employees')
        .update(stripUndefined(patch))
        .eq('id', existing.id);
      if (error) throw error;
      updatedCount += 1;
      const updatedRows = Array.isArray(data) ? (data as Array<{ id?: string }>) : [];
      employeeIds.push(String(updatedRows[0]?.id ?? existing.id));
      continue;
    }

    const createPatch = {
      ...stripUndefined(patch),
      processing_status: patch.processing_status ?? 'pending',
    };
    const { data, error } = await client.from('employees').insert(createPatch).select('id').single();
    if (error || !data) throw error ?? new Error('Failed to create employee');
    createdCount += 1;
    employeeIds.push(String((data as { id: string }).id));
  }

  return { createdCount, updatedCount, employeeIds };
}

function buildPreviewItems(records: CompanyImportInput[]) {
  return records.map(normalizeCompanyInput).map((input) => {
    const warnings = validateCompanyInput(input);
    return {
      input,
      warnings,
    };
  });
}

export async function previewCompanyImport(
  client: SupabaseClient,
  records: CompanyImportInput[]
): Promise<CompanyImportResult> {
  const normalized = buildPreviewItems(records);
  const items: CompanyImportPreviewItem[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const { input, warnings } of normalized) {
    let action: ImportAction = 'skip';
    let matchField: 'tin' | 'registration_number' | null = null;
    let itemWarnings = [...warnings];
    if (warnings.length > 0) {
      skippedCount += 1;
    } else {
      const existing = await findExistingCompany(client, input);
      matchField = existing?.match_field ?? null;
      itemWarnings = buildCompanyMatchWarnings(input, existing, warnings);
      action = existing ? 'update' : 'create';
      if (action === 'create') createdCount += 1;
      if (action === 'update') updatedCount += 1;
    }

    items.push({
      company_name: input.company_name,
      tin: input.tin ?? null,
      action,
      match_field: matchField,
      office_qualification: input.office_qualification ?? null,
      warnings: itemWarnings,
    });
  }

  return {
    mode: 'dry-run',
    summary: {
      total_count: records.length,
      created_count: createdCount,
      updated_count: updatedCount,
      skipped_count: skippedCount,
      employee_created_count: 0,
      employee_updated_count: 0,
    },
    items,
  };
}

export async function applyCompanyImport(
  client: SupabaseClient,
  records: CompanyImportInput[]
): Promise<CompanyImportResult> {
  const preview = await previewCompanyImport(client, records);
  let employeeCreatedCount = 0;
  let employeeUpdatedCount = 0;
  const applied: NonNullable<CompanyImportResult['applied']> = [];

  for (let index = 0; index < preview.items.length; index += 1) {
    const previewItem = preview.items[index];
    if (previewItem.action === 'skip') {
      continue;
    }

    const input = normalizeCompanyInput(records[index] as CompanyImportInput);
    const company = await upsertCompany(client, input);
    const employeeSummary = await upsertEmployees(
      client,
      company.id,
      input.company_name,
      input.employees,
      { preferCompanyScopedName: false }
    );
    applied.push({
      index,
      company_id: company.id,
      action: company.action,
    });
    employeeCreatedCount += employeeSummary.createdCount;
    employeeUpdatedCount += employeeSummary.updatedCount;
  }

  return {
    mode: 'apply',
    summary: {
      ...preview.summary,
      employee_created_count: employeeCreatedCount,
      employee_updated_count: employeeUpdatedCount,
    },
    items: preview.items,
    applied,
  };
}

export async function saveProcessedCompany(
  client: SupabaseClient,
  payload: CompanySaveProcessedPayload
): Promise<CompanySaveProcessedResult> {
  const normalizedEmployees = normalizeProcessedSaveEmployees(payload.employees ?? []);
  const input = normalizeCompanyInput({
    ...payload.company,
    employees: normalizedEmployees.employees,
  });
  const warnings = validateCompanyInput(input);
  if (warnings.length > 0) {
    const error: any = new Error('processed company payload failed validation');
    error.code = 'INVALID_PAYLOAD';
    error.details = {
      warnings,
      missing_fields: listMissingFields(input),
      invalid_fields: listInvalidFields(input),
    };
    throw error;
  }

  const company = await upsertCompany(client, input);
  const employeeSummary = await upsertEmployees(
    client,
    company.id,
    input.company_name,
    input.employees,
    { preferCompanyScopedName: true }
  );

  for (const repair of normalizedEmployees.audits) {
    const employeeId = employeeSummary.employeeIds[repair.employeeIndex];
    if (!employeeId) {
      continue;
    }
    await recordEmployeeDataRepair(client, {
      employee_id: employeeId,
      repair_type: repair.audit.repair_type,
      source: 'company:save-processed',
      confidence: repair.audit.confidence,
      original_first_name: repair.audit.original_first_name,
      original_last_name: repair.audit.original_last_name,
      repaired_first_name: repair.audit.repaired_first_name,
      repaired_last_name: repair.audit.repaired_last_name,
    });
  }

  return {
    company_id: company.id,
    employee_ids: employeeSummary.employeeIds,
    warnings: normalizedEmployees.warnings,
    company_action: company.action,
    employee_created_count: employeeSummary.createdCount,
    employee_updated_count: employeeSummary.updatedCount,
  };
}

import type { SupabaseClient } from '@supabase/supabase-js';

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeEmail(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : null;
}

function buildContactPatch(patch: Record<string, unknown>) {
  const next: Record<string, unknown> = {};
  if ('full_name' in patch) {
    const value = normalizeString(patch.full_name);
    if (!value) throw new Error('full_name cannot be empty');
    next.full_name = value;
  }
  if ('first_name' in patch) next.first_name = normalizeString(patch.first_name);
  if ('last_name' in patch) next.last_name = normalizeString(patch.last_name);
  if ('middle_name' in patch) next.middle_name = normalizeString(patch.middle_name);
  if ('position' in patch) next.position = normalizeString(patch.position);
  if ('work_email' in patch) next.work_email = normalizeEmail(patch.work_email);
  if ('generic_email' in patch) next.generic_email = normalizeEmail(patch.generic_email);
  if ('processing_status' in patch) next.processing_status = normalizeString(patch.processing_status);
  return next;
}

function buildCompanyPatch(patch: Record<string, unknown>) {
  const next: Record<string, unknown> = {};
  if ('company_name' in patch) {
    const value = normalizeString(patch.company_name);
    if (!value) throw new Error('company_name cannot be empty');
    next.company_name = value;
  }
  if ('website' in patch) next.website = normalizeString(patch.website);
  if ('segment' in patch) next.segment = normalizeString(patch.segment);
  if ('status' in patch) next.status = normalizeString(patch.status);
  if ('office_qualification' in patch) next.office_qualification = normalizeString(patch.office_qualification);
  if ('employee_count' in patch) {
    next.employee_count = typeof patch.employee_count === 'number' ? patch.employee_count : null;
  }
  if ('primary_email' in patch) next.primary_email = normalizeEmail(patch.primary_email);
  if ('company_description' in patch) next.company_description = normalizeString(patch.company_description);
  if ('region' in patch) next.region = normalizeString(patch.region);
  if ('processing_status' in patch) next.processing_status = normalizeString(patch.processing_status);
  return next;
}

export async function updateDirectoryContact(
  client: SupabaseClient,
  contactId: string,
  patch: Record<string, unknown>
) {
  const normalizedPatch = buildContactPatch(patch);
  const { data, error } = await client
    .from('employees')
    .update(normalizedPatch)
    .eq('id', contactId)
    .select('id,full_name,position,work_email,generic_email,processing_status,updated_at')
    .single();
  if (error) throw error;
  return {
    contactId: String(data.id),
    fullName: typeof data.full_name === 'string' ? data.full_name : null,
    position: typeof data.position === 'string' ? data.position : null,
    workEmail: typeof data.work_email === 'string' ? data.work_email : null,
    genericEmail: typeof data.generic_email === 'string' ? data.generic_email : null,
    processingStatus: typeof data.processing_status === 'string' ? data.processing_status : null,
    updatedAt: typeof data.updated_at === 'string' ? data.updated_at : null,
  };
}

export async function updateDirectoryCompany(
  client: SupabaseClient,
  companyId: string,
  patch: Record<string, unknown>
) {
  const normalizedPatch = buildCompanyPatch(patch);
  const { data, error } = await client
    .from('companies')
    .update(normalizedPatch)
    .eq('id', companyId)
    .select('id,company_name,website,segment,status,office_qualification,employee_count,primary_email,company_description,region,processing_status,updated_at')
    .single();
  if (error) throw error;
  return {
    companyId: String(data.id),
    companyName: typeof data.company_name === 'string' ? data.company_name : null,
    website: typeof data.website === 'string' ? data.website : null,
    segment: typeof data.segment === 'string' ? data.segment : null,
    status: typeof data.status === 'string' ? data.status : null,
    officeQualification:
      typeof data.office_qualification === 'string' ? data.office_qualification : null,
    employeeCount: typeof data.employee_count === 'number' ? data.employee_count : null,
    primaryEmail: typeof data.primary_email === 'string' ? data.primary_email : null,
    companyDescription:
      typeof data.company_description === 'string' ? data.company_description : null,
    region: typeof data.region === 'string' ? data.region : null,
    processingStatus: typeof data.processing_status === 'string' ? data.processing_status : null,
    updatedAt: typeof data.updated_at === 'string' ? data.updated_at : null,
  };
}

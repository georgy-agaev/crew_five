import * as XLSX from 'xlsx';
import type { CompanyImportRecord, CompanyImportEmployee } from '../apiClient';

// ============================================================
// Kontur.Kompas / Kontur.Fokus column mapping (v1 source profile)
// ============================================================

const COLUMN_MAP: Record<string, string> = {
  // Company name
  'наименование': 'company_name',
  'название': 'company_name',
  'company_name': 'company_name',
  'компания': 'company_name',
  // TIN
  'инн': 'tin',
  'tin': 'tin',
  // Registration number
  'огрн': 'registration_number',
  'registration_number': 'registration_number',
  // Registration date
  'дата регистрации': 'registration_date',
  'registration_date': 'registration_date',
  // Region
  'регион': 'region',
  'region': 'region',
  'регион регистрации': 'region',
  // Status
  'статус': 'status',
  'status': 'status',
  // Website
  'сайт': 'website',
  'website': 'website',
  'ссылка на сайт': 'website',
  'веб-сайт': 'website',
  'адрес сайта': 'website',
  // CEO
  'руководитель': 'ceo_name',
  'ceo_name': 'ceo_name',
  'фио руководителя': 'ceo_name',
  'должность руководителя': 'ceo_position',
  'ceo_position': 'ceo_position',
  // Email
  'email': 'primary_email',
  'primary_email': 'primary_email',
  'электронная почта': 'primary_email',
  'e-mail': 'primary_email',
  // Employee count
  'количество сотрудников': 'employee_count',
  'численность': 'employee_count',
  'employee_count': 'employee_count',
  // Segment
  'сегмент': 'segment',
  'segment': 'segment',
  'название сегмента': 'segment',
  // Description
  'описание': 'company_description',
  'company_description': 'company_description',
  'основной вид деятельности': 'company_description',
  // Office qualification
  'офис': 'office_qualification',
  'office_qualification': 'office_qualification',
  // Source
  'источник': 'source',
  'source': 'source',
  // Financial
  'выручка': 'revenue',
  'revenue': 'revenue',
  'баланс': 'balance',
  'balance': 'balance',
  'чистая прибыль/ убыток': 'net_profit_loss',
  'чистая прибыль/убыток': 'net_profit_loss',
  'net_profit_loss': 'net_profit_loss',
  // SME registry
  'реестр мсп': 'sme_registry',
  'sme_registry': 'sme_registry',
  // Address (informational)
  'адрес': 'address',
  // Employee fields
  'фио': 'emp_full_name',
  'full_name': 'emp_full_name',
  'имя': 'emp_first_name',
  'first_name': 'emp_first_name',
  'фамилия': 'emp_last_name',
  'last_name': 'emp_last_name',
  'отчество': 'emp_middle_name',
  'middle_name': 'emp_middle_name',
  'должность': 'emp_position',
  'position': 'emp_position',
  'рабочий email': 'emp_work_email',
  'work_email': 'emp_work_email',
  'общий email': 'emp_generic_email',
  'generic_email': 'emp_generic_email',
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeEmail(val: unknown): string | null {
  if (typeof val !== 'string' || !val.trim()) return null;
  // Take first email if multiple (newline-separated from Kontur)
  const first = val.split('\n')[0].trim().toLowerCase();
  return first.length > 0 ? first : null;
}

function extractAllEmails(val: unknown): string[] | null {
  if (typeof val !== 'string' || !val.trim()) return null;
  const emails = val.split('\n').map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@'));
  return emails.length > 0 ? emails : null;
}

function normalizeString(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  return s.length > 0 ? s : null;
}

function normalizeWebsite(val: unknown): string | null {
  if (typeof val !== 'string' || !val.trim()) return null;
  let s = val.trim();
  // Strip protocol
  s = s.replace(/^https?:\/\//i, '');
  // Strip www.
  s = s.replace(/^www\./i, '');
  // Strip trailing slash
  s = s.replace(/\/+$/, '');
  return s.length > 0 ? s : null;
}

function normalizeNumber(val: unknown): number | null {
  if (val == null || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

/** Normalize TIN/OGRN — strip trailing .0 from Excel float representation */
function normalizeNumericId(val: unknown): string | null {
  if (val == null || val === '') return null;
  let s = String(val).trim();
  // Remove trailing .0 (Excel stores numbers as floats)
  if (/^\d+\.0$/.test(s)) {
    s = s.replace(/\.0$/, '');
  }
  return s.length > 0 ? s : null;
}

function normalizeSmeRegistry(val: unknown): string | null {
  if (val == null || val === '') return null;
  const s = String(val).trim().toLowerCase();
  // "Не входит" = not in SME registry → false
  // Any other value (Малое, Микро, Среднее, Входит, etc.) = in SME registry → true
  if (s === 'не входит' || s === 'нет' || s === 'no' || s === 'false') return 'false';
  return 'true';
}

function normalizeDate(val: unknown): string | null {
  if (val == null || val === '') return null;
  const s = String(val).trim();
  if (!s) return null;
  // Excel date serial number
  const num = Number(s);
  if (!isNaN(num) && num > 1000 && num < 200000 && !s.includes('-') && !s.includes('/')) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + num * 86400000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }
  // ISO-like or other string date
  return s;
}

// ============================================================
// Group key: tin > registration_number > company_name+website
// ============================================================

function companyGroupKey(row: Record<string, string>): string {
  const tin = normalizeNumericId(row.tin);
  if (tin) return `tin::${tin}`;
  const regNum = normalizeNumericId(row.registration_number);
  if (regNum) return `reg::${regNum}`;
  const name = normalizeString(row.company_name) ?? '';
  const website = normalizeString(row.website) ?? '';
  return `name::${name.toLowerCase()}::${website.toLowerCase()}`;
}

// ============================================================
// Public API
// ============================================================

export function parseXlsxFile(buffer: ArrayBuffer): Record<string, string>[][] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheets: Record<string, string>[][] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    const mapped = json.map((row) => {
      const result: Record<string, string> = {};
      for (const [header, value] of Object.entries(row)) {
        const normalized = normalizeHeader(header);
        const canonical = COLUMN_MAP[normalized];
        if (canonical) {
          result[canonical] = String(value ?? '');
        }
      }
      return result;
    });
    if (mapped.length > 0) sheets.push(mapped);
  }

  return sheets;
}

export function normalizeToCanonical(
  rows: Record<string, string>[],
  batchId: string,
  source?: string
): CompanyImportRecord[] {
  // Group rows by company
  const groups = new Map<string, Record<string, string>[]>();
  for (const row of rows) {
    if (!normalizeString(row.company_name)) continue;
    const key = companyGroupKey(row);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const records: CompanyImportRecord[] = [];
  for (const groupRows of groups.values()) {
    const first = groupRows[0];
    const resolvedSource = source ?? normalizeString(first.source) ?? 'Kontur.Kompas';

    // Collect employees from all rows in the group
    const employees: CompanyImportEmployee[] = [];
    for (const row of groupRows) {
      const fullName = normalizeString(row.emp_full_name);
      if (!fullName) continue;
      employees.push({
        full_name: fullName,
        first_name: normalizeString(row.emp_first_name),
        last_name: normalizeString(row.emp_last_name),
        middle_name: normalizeString(row.emp_middle_name),
        position: normalizeString(row.emp_position),
        work_email: normalizeEmail(row.emp_work_email),
        generic_email: normalizeEmail(row.emp_generic_email),
        source_service: resolvedSource,
        processing_status: 'pending',
      });
    }

    records.push({
      company_name: normalizeString(first.company_name)!,
      tin: normalizeNumericId(first.tin),
      registration_number: normalizeNumericId(first.registration_number),
      registration_date: normalizeDate(first.registration_date),
      region: normalizeString(first.region),
      status: normalizeString(first.status),
      website: normalizeWebsite(first.website),
      ceo_name: normalizeString(first.ceo_name),
      ceo_position: normalizeString(first.ceo_position),
      primary_email: normalizeEmail(first.primary_email),
      employee_count: normalizeNumber(first.employee_count),
      source: resolvedSource,
      segment: normalizeString(first.segment),
      company_description: normalizeString(first.company_description),
      office_qualification: normalizeString(first.office_qualification),
      all_company_emails: extractAllEmails(first.primary_email),
      batch_id: batchId,
      processing_status: 'pending',
      revenue: normalizeNumber(first.revenue),
      balance: normalizeNumber(first.balance),
      net_profit_loss: normalizeNumber(first.net_profit_loss),
      sme_registry: normalizeSmeRegistry(first.sme_registry),
      employees: employees.length > 0 ? employees : undefined,
    });
  }

  return records;
}

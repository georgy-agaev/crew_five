import type { SupabaseClient } from '@supabase/supabase-js';
import { recordEmployeeDataRepair } from './employeeDataRepairs';

export type RepairConfidence = 'high' | 'low';
export type RepairConfidenceFilter = RepairConfidence | 'all';

interface EmployeeNameRow {
  id: string;
  company_id: string | null;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
}

export interface EmployeeNameRepairCandidate {
  employee_id: string;
  company_id: string | null;
  full_name: string;
  current_first_name: string | null;
  current_last_name: string | null;
  proposed_first_name: string | null;
  proposed_last_name: string | null;
  confidence: RepairConfidence;
}

export interface EmployeeNameRepairResult {
  mode: 'dry-run' | 'apply';
  summary: {
    scanned_count: number;
    candidate_count: number;
    fixable_count: number;
    skipped_count: number;
    updated_count: number;
  };
  candidates: EmployeeNameRepairCandidate[];
}

export interface EmployeeNameNormalizationResult {
  first_name: string | null;
  last_name: string | null;
  warnings: string[];
  audit: {
    repair_type: 'name_swap';
    confidence: RepairConfidence;
    original_first_name: string | null;
    original_last_name: string | null;
    repaired_first_name: string | null;
    repaired_last_name: string | null;
  } | null;
}

const COMMON_FIRST_NAMES = new Set([
  'александр',
  'александра',
  'алексей',
  'анастасия',
  'андрей',
  'анна',
  'артем',
  'артём',
  'бабихина', // intentionally not used as first name; acts as negative in tests by omission
  'василий',
  'виктор',
  'виктория',
  'виталий',
  'владимир',
  'галина',
  'георгий',
  'дмитрий',
  'екатерина',
  'елена',
  'игорь',
  'инна',
  'ирина',
  'ксения',
  'марина',
  'мария',
  'михаил',
  'наталья',
  'николай',
  'оксана',
  'ольга',
  'павел',
  'петр',
  'пётр',
  'роман',
  'светлана',
  'сергей',
  'татьяна',
  'юлия',
  'яна',
]);

function normalizeToken(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized.length > 0 ? normalized : null;
}

function tokenizeFullName(fullName: string): string[] {
  return fullName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function isKnownFirstName(value: string | null | undefined): boolean {
  const normalized = normalizeToken(value);
  return normalized ? COMMON_FIRST_NAMES.has(normalized) : false;
}

function detectNameRepair(row: EmployeeNameRow): EmployeeNameRepairCandidate | null {
  const tokens = tokenizeFullName(row.full_name);
  if (tokens.length !== 2) {
    return null;
  }

  const [tokenA, tokenB] = tokens;
  const currentFirst = normalizeToken(row.first_name);
  const currentLast = normalizeToken(row.last_name);
  const firstToken = normalizeToken(tokenA);
  const lastToken = normalizeToken(tokenB);

  if (!currentFirst || !currentLast || !firstToken || !lastToken) {
    return null;
  }

  const looksSwapped = currentFirst === lastToken && currentLast === firstToken;
  if (!looksSwapped) {
    return null;
  }

  const confidence: RepairConfidence = isKnownFirstName(tokenA) && !isKnownFirstName(tokenB) ? 'high' : 'low';

  return {
    employee_id: row.id,
    company_id: row.company_id,
    full_name: row.full_name,
    current_first_name: row.first_name,
    current_last_name: row.last_name,
    proposed_first_name: tokenA,
    proposed_last_name: tokenB,
    confidence,
  };
}

function filterCandidates(
  candidates: EmployeeNameRepairCandidate[],
  confidence?: RepairConfidenceFilter
): EmployeeNameRepairCandidate[] {
  if (!confidence) {
    return candidates;
  }
  if (confidence === 'all') {
    return candidates;
  }
  return candidates.filter((candidate) => candidate.confidence === confidence);
}

function getFixableCandidates(
  candidates: EmployeeNameRepairCandidate[],
  confidence?: RepairConfidenceFilter
): EmployeeNameRepairCandidate[] {
  if (!confidence || confidence === 'high') {
    return candidates.filter((candidate) => candidate.confidence === 'high');
  }
  if (confidence === 'all') {
    return candidates;
  }
  return candidates.filter((candidate) => candidate.confidence === confidence);
}

export function normalizeEmployeeNameParts(input: {
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
}): EmployeeNameNormalizationResult {
  const firstName = input.first_name?.trim() ?? null;
  const lastName = input.last_name?.trim() ?? null;
  const candidate = detectNameRepair({
    id: 'preview',
    company_id: null,
    full_name: input.full_name,
    first_name: firstName,
    last_name: lastName,
  });

  if (!candidate) {
    return {
      first_name: firstName,
      last_name: lastName,
      warnings: [],
      audit: null,
    };
  }

  if (candidate.confidence === 'high') {
    return {
      first_name: candidate.proposed_first_name,
      last_name: candidate.proposed_last_name,
      warnings: [
        `employee name normalized from swapped first/last fields: ${candidate.full_name}`,
      ],
      audit: {
        repair_type: 'name_swap',
        confidence: candidate.confidence,
        original_first_name: firstName,
        original_last_name: lastName,
        repaired_first_name: candidate.proposed_first_name,
        repaired_last_name: candidate.proposed_last_name,
      },
    };
  }

  return {
    first_name: firstName,
    last_name: lastName,
    warnings: [
      `employee name left unchanged for low-confidence repair candidate: ${candidate.full_name}`,
    ],
    audit: null,
  };
}

async function loadEmployeeCandidates(client: SupabaseClient): Promise<EmployeeNameRow[]> {
  const { data, error } = await client
    .from('employees')
    .select('id,company_id,full_name,first_name,last_name')
    .not('first_name', 'is', null)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as EmployeeNameRow[]).filter((row) => Boolean(row.full_name));
}

async function collectEmployeeNameRepairs(client: SupabaseClient): Promise<{
  scannedCount: number;
  candidates: EmployeeNameRepairCandidate[];
}> {
  const rows = await loadEmployeeCandidates(client);
  const candidates = rows
    .map((row) => detectNameRepair(row))
    .filter((row): row is EmployeeNameRepairCandidate => row !== null);

  return {
    scannedCount: rows.length,
    candidates,
  };
}

export async function previewEmployeeNameRepairs(
  client: SupabaseClient,
  options: { confidence?: RepairConfidenceFilter } = {}
): Promise<EmployeeNameRepairResult> {
  const { scannedCount, candidates } = await collectEmployeeNameRepairs(client);
  const visibleCandidates = filterCandidates(candidates, options.confidence);
  const fixable = getFixableCandidates(candidates, options.confidence);
  const candidateCount = options.confidence ? visibleCandidates.length : candidates.length;
  const skippedCount = options.confidence
    ? Math.max(0, visibleCandidates.length - fixable.length)
    : candidates.length - fixable.length;

  return {
    mode: 'dry-run',
    summary: {
      scanned_count: scannedCount,
      candidate_count: candidateCount,
      fixable_count: fixable.length,
      skipped_count: skippedCount,
      updated_count: 0,
    },
    candidates: visibleCandidates,
  };
}

export async function applyEmployeeNameRepairs(
  client: SupabaseClient,
  options: { confidence?: RepairConfidenceFilter } = {}
): Promise<EmployeeNameRepairResult> {
  const preview = await previewEmployeeNameRepairs(client, options);
  const fixable = getFixableCandidates(preview.candidates, options.confidence);

  for (const candidate of fixable) {
    const { error } = await client
      .from('employees')
      .update({
        first_name: candidate.proposed_first_name,
        last_name: candidate.proposed_last_name,
      })
      .eq('id', candidate.employee_id);

    if (error) {
      throw error;
    }

    await recordEmployeeDataRepair(client, {
      employee_id: candidate.employee_id,
      repair_type: 'name_swap',
      source: 'employee:repair-names',
      confidence: candidate.confidence,
      original_first_name: candidate.current_first_name,
      original_last_name: candidate.current_last_name,
      repaired_first_name: candidate.proposed_first_name,
      repaired_last_name: candidate.proposed_last_name,
    });
  }

  return {
    mode: 'apply',
    summary: {
      ...preview.summary,
      updated_count: fixable.length,
      skipped_count: Math.max(0, preview.candidates.length - fixable.length),
    },
    candidates: preview.candidates,
  };
}

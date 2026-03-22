/* eslint-disable security-node/detect-unhandled-async-errors */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface EmployeeDataRepairInput {
  employee_id: string;
  repair_type: 'name_swap';
  source: 'employee:repair-names' | 'company:save-processed';
  confidence: 'high' | 'low';
  original_first_name: string | null;
  original_last_name: string | null;
  repaired_first_name: string | null;
  repaired_last_name: string | null;
}

export const EMPLOYEE_DATA_REPAIRS_CONFLICT_COLUMNS =
  'employee_id,repair_type,source,original_first_name,original_last_name,repaired_first_name,repaired_last_name';

export async function recordEmployeeDataRepair(
  client: SupabaseClient,
  repair: EmployeeDataRepairInput
): Promise<void> {
  const { error } = await client.from('employee_data_repairs').upsert([repair], {
    onConflict: EMPLOYEE_DATA_REPAIRS_CONFLICT_COLUMNS,
    ignoreDuplicates: true,
  });

  if (error) {
    throw error;
  }
}

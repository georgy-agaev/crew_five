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

export async function recordEmployeeDataRepair(
  client: SupabaseClient,
  repair: EmployeeDataRepairInput
): Promise<void> {
  // Use plain insert and ignore duplicates because the backing uniqueness is implemented
  // via an expression index (`coalesce(...)`) which cannot be targeted by PostgREST on_conflict.
  const { error } = await client.from('employee_data_repairs').insert([repair]);

  if (error) {
    const code = typeof (error as any).code === 'string' ? String((error as any).code) : '';
    if (code === '23505') {
      return;
    }
    throw error;
  }
}

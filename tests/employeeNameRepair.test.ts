import { describe, expect, it, vi } from 'vitest';

import { previewEmployeeNameRepairs, applyEmployeeNameRepairs } from '../src/services/employeeNameRepair';

function createSelectChain(rows: unknown[]) {
  const order = vi.fn().mockResolvedValue({ data: rows, error: null });
  const not = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ not });
  return { select, not, order };
}

describe('employeeNameRepair', () => {
  it('detects swapped first and last names for high-confidence two-word Russian names', async () => {
    const rows = [
      {
        id: 'emp-1',
        full_name: 'Инна Федина',
        first_name: 'Федина',
        last_name: 'Инна',
        company_id: 'comp-1',
      },
      {
        id: 'emp-2',
        full_name: 'Иван Петров',
        first_name: 'Иван',
        last_name: 'Петров',
        company_id: 'comp-1',
      },
    ];
    const chain = createSelectChain(rows);
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        expect(table).toBe('employees');
        return { select: chain.select };
      }),
    } as any;

    const result = await previewEmployeeNameRepairs(client);

    expect(result.summary.candidate_count).toBe(1);
    expect(result.summary.fixable_count).toBe(1);
    expect(result.summary.skipped_count).toBe(0);
    expect(result.candidates[0]).toMatchObject({
      employee_id: 'emp-1',
      current_first_name: 'Федина',
      current_last_name: 'Инна',
      proposed_first_name: 'Инна',
      proposed_last_name: 'Федина',
      confidence: 'high',
    });
  });

  it('skips low-confidence rows instead of proposing a fix', async () => {
    const rows = [
      {
        id: 'emp-3',
        full_name: 'Тест Пользователь',
        first_name: 'Пользователь',
        last_name: 'Тест',
        company_id: 'comp-2',
      },
    ];
    const chain = createSelectChain(rows);
    const client = {
      from: vi.fn().mockReturnValue({ select: chain.select }),
    } as any;

    const result = await previewEmployeeNameRepairs(client);

    expect(result.summary.candidate_count).toBe(1);
    expect(result.summary.fixable_count).toBe(0);
    expect(result.summary.skipped_count).toBe(1);
    expect(result.candidates[0]?.confidence).toBe('low');
  });

  it('applies high-confidence fixes and returns idempotent summary', async () => {
    const rows = [
      {
        id: 'emp-1',
        full_name: 'Инна Федина',
        first_name: 'Федина',
        last_name: 'Инна',
        company_id: 'comp-1',
      },
      {
        id: 'emp-2',
        full_name: 'Иван Петров',
        first_name: 'Иван',
        last_name: 'Петров',
        company_id: 'comp-1',
      },
    ];
    const chain = createSelectChain(rows);
    const eq = vi.fn().mockResolvedValue({ data: [{ id: 'emp-1' }], error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const repairsInsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = {
      from: vi.fn().mockImplementation(() => ({
        select: chain.select,
        update,
        insert: repairsInsert,
      })),
    } as any;

    const result = await applyEmployeeNameRepairs(client);

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      first_name: 'Инна',
      last_name: 'Федина',
    });
    expect(eq).toHaveBeenCalledWith('id', 'emp-1');
    expect(repairsInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        employee_id: 'emp-1',
        repair_type: 'name_swap',
        source: 'employee:repair-names',
        confidence: 'high',
        original_first_name: 'Федина',
        original_last_name: 'Инна',
        repaired_first_name: 'Инна',
        repaired_last_name: 'Федина',
      }),
    ]);
    expect(result.summary.updated_count).toBe(1);
    expect(result.summary.skipped_count).toBe(0);
  });

  it('filters preview candidates by requested confidence level', async () => {
    const rows = [
      {
        id: 'emp-1',
        full_name: 'Инна Федина',
        first_name: 'Федина',
        last_name: 'Инна',
        company_id: 'comp-1',
      },
      {
        id: 'emp-2',
        full_name: 'Тест Пользователь',
        first_name: 'Пользователь',
        last_name: 'Тест',
        company_id: 'comp-2',
      },
    ];
    const chain = createSelectChain(rows);
    const client = {
      from: vi.fn().mockReturnValue({ select: chain.select }),
    } as any;

    const result = await previewEmployeeNameRepairs(client, { confidence: 'low' });

    expect(result.summary.candidate_count).toBe(1);
    expect(result.summary.fixable_count).toBe(1);
    expect(result.summary.skipped_count).toBe(0);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.confidence).toBe('low');
  });

  it('applies all requested confidence candidates when explicitly allowed', async () => {
    const rows = [
      {
        id: 'emp-1',
        full_name: 'Инна Федина',
        first_name: 'Федина',
        last_name: 'Инна',
        company_id: 'comp-1',
      },
      {
        id: 'emp-2',
        full_name: 'Тест Пользователь',
        first_name: 'Пользователь',
        last_name: 'Тест',
        company_id: 'comp-2',
      },
    ];
    const chain = createSelectChain(rows);
    const eq = vi.fn().mockResolvedValue({ data: [{ id: 'emp-1' }], error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const repairsInsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = {
      from: vi.fn().mockImplementation(() => ({
        select: chain.select,
        update,
        insert: repairsInsert,
      })),
    } as any;

    const result = await applyEmployeeNameRepairs(client, { confidence: 'all' });

    expect(update).toHaveBeenCalledTimes(2);
    expect(repairsInsert).toHaveBeenCalledTimes(2);
    expect(result.summary.updated_count).toBe(2);
    expect(result.summary.candidate_count).toBe(2);
  });
});

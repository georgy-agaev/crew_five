import { describe, expect, it, vi } from 'vitest';

import { applyCompanyImport, previewCompanyImport, saveProcessedCompany } from '../src/services/companyStore';

function createCompanyLookup(config: {
  byTin?: Record<string, Record<string, unknown>>;
  byRegistrationNumber?: Record<string, Record<string, unknown>>;
}) {
  let activeValue: string | null = null;
  let activeField: 'tin' | 'registration_number' | null = null;
  const maybeSingle = vi.fn(async () => ({
    data:
      activeField === 'tin'
        ? activeValue
          ? config.byTin?.[activeValue] ?? null
          : null
        : activeField === 'registration_number'
          ? activeValue
            ? config.byRegistrationNumber?.[activeValue] ?? null
            : null
          : null,
    error: null,
  }));
  const eq = vi.fn().mockImplementation((field: string, value: string) => {
    activeField = field === 'registration_number' ? 'registration_number' : 'tin';
    activeValue = value;
    return { maybeSingle };
  });
  const insertSelectSingle = vi.fn(async () => ({
    data: { id: 'new-company-id' },
    error: null,
  }));
  const insertSelect = vi.fn().mockReturnValue({ single: insertSelectSingle });
  const insert = vi.fn().mockReturnValue({ select: insertSelect });
  const updateEq = vi.fn(async () => ({
    data: [
      {
        id:
          (activeField === 'tin' && activeValue && config.byTin?.[activeValue]?.id) ||
          (activeField === 'registration_number' &&
            activeValue &&
            config.byRegistrationNumber?.[activeValue]?.id) ||
          'existing-company-id',
      },
    ],
    error: null,
  }));
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  return { eq, maybeSingle, insert, insertSelect, insertSelectSingle, update, updateEq };
}

function createEmployeeTable() {
  const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  const eqSecond = vi.fn().mockReturnValue({ maybeSingle });
  const eqFirst = vi.fn().mockReturnValue({ maybeSingle, eq: eqSecond });
  const select = vi.fn().mockReturnValue({ eq: eqFirst });
  const insertSelectSingle = vi.fn(async () => ({
    data: { id: 'new-employee-id' },
    error: null,
  }));
  const insertSelect = vi.fn().mockReturnValue({ single: insertSelectSingle });
  const insert = vi.fn().mockReturnValue({ select: insertSelect });
  const updateEq = vi.fn(async () => ({ data: [{ id: 'existing-employee-id' }], error: null }));
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  return { select, eqFirst, eqSecond, maybeSingle, insert, insertSelect, insertSelectSingle, update, updateEq };
}

function createProcessedEmployeeTable() {
  let activeCompanyId: string | null = null;
  let activeFullName: string | null = null;
  const maybeSingle = vi.fn(async () => ({
    data:
      activeCompanyId === 'existing-company-id' && activeFullName === 'Инна Федина'
        ? { id: 'existing-employee-id' }
        : null,
    error: null,
  }));
  const eqSecond = vi.fn().mockImplementation((_field: string, value: string) => {
    activeFullName = value;
    return { maybeSingle };
  });
  const eqFirst = vi.fn().mockImplementation((field: string, value: string) => {
    if (field === 'company_id') {
      activeCompanyId = value;
      activeFullName = null;
      return { eq: eqSecond, maybeSingle };
    }
    activeCompanyId = null;
    activeFullName = value;
    return { maybeSingle };
  });
  const select = vi.fn().mockReturnValue({ eq: eqFirst });
  const insertSelectSingle = vi.fn(async () => ({
    data: { id: 'new-employee-id' },
    error: null,
  }));
  const insertSelect = vi.fn().mockReturnValue({ single: insertSelectSingle });
  const insert = vi.fn().mockReturnValue({ select: insertSelect });
  const updateEq = vi.fn(async () => ({ data: [{ id: 'existing-employee-id' }], error: null }));
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  return {
    select,
    eqFirst,
    eqSecond,
    maybeSingle,
    insert,
    insertSelect,
    insertSelectSingle,
    update,
    updateEq,
  };
}

function createEmployeeRepairTable() {
  const insert = vi.fn().mockResolvedValue({ data: null, error: null });
  return { insert };
}

describe('companyStore', () => {
  it('previews company import with duplicate detection and office qualification', async () => {
    const companyTable = createCompanyLookup({
      byTin: { '1234567890': { id: 'existing-company-id', tin: '1234567890' } },
    });
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'companies') {
          return {
            select: vi.fn().mockReturnValue({ eq: companyTable.eq }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await previewCompanyImport(client, [
      {
        company_name: 'ООО Обновление',
        tin: '1234567890',
        employee_count: 80,
      },
      {
        company_name: 'ООО Новая',
        tin: '0987654321',
        employee_count: 20,
      },
    ]);

    expect(result.summary.updated_count).toBe(1);
    expect(result.summary.created_count).toBe(1);
    expect(result.summary.skipped_count).toBe(0);
    expect(result.items[0]?.office_qualification).toBe('More');
    expect(result.items[0]?.action).toBe('update');
    expect(result.items[1]?.office_qualification).toBe('Less');
    expect(result.items[1]?.action).toBe('create');
  });

  it('applies company import and writes company plus employee rows', async () => {
    const companyTable = createCompanyLookup({});
    const employeeTable = createEmployeeTable();
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'companies') {
          return {
            select: vi.fn().mockReturnValue({ eq: companyTable.eq }),
            insert: companyTable.insert,
            update: companyTable.update,
          };
        }
        if (table === 'employees') {
          return {
            select: employeeTable.select,
            insert: employeeTable.insert,
            update: employeeTable.update,
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await applyCompanyImport(client, [
      {
        company_name: 'ООО Новая',
        tin: '0987654321',
        employee_count: 55,
        employees: [
          {
            full_name: 'Инна Федина',
            position: 'Директор',
            generic_email: 'info@example.ru',
          },
        ],
      },
    ]);

    expect(companyTable.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_name: 'ООО Новая',
        tin: '0987654321',
        office_qualification: 'More',
      })
    );
    expect(employeeTable.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: 'new-company-id',
        full_name: 'Инна Федина',
        generic_email: 'info@example.ru',
      })
    );
    expect(result.summary.created_count).toBe(1);
    expect(result.summary.employee_created_count).toBe(1);
  });

  it('skips invalid rows during import preview', async () => {
    const client = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          }),
        }),
      })),
    } as any;

    const result = await previewCompanyImport(client, [
      {
        company_name: '',
        tin: '1234567890',
      },
    ]);

    expect(result.summary.skipped_count).toBe(1);
    expect(result.items[0]?.warnings).toContain('company_name is required');
    expect(result.items[0]?.action).toBe('skip');
  });

  it('saves a processed company bundle and upserts employees by company plus full_name', async () => {
    const companyTable = createCompanyLookup({
      byTin: { '7707083893': { id: 'existing-company-id', tin: '7707083893' } },
    });
    const employeeTable = createProcessedEmployeeTable();
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'companies') {
          return {
            select: vi.fn().mockReturnValue({ eq: companyTable.eq }),
            insert: companyTable.insert,
            update: companyTable.update,
          };
        }
        if (table === 'employees') {
          return {
            select: employeeTable.select,
            insert: employeeTable.insert,
            update: employeeTable.update,
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await saveProcessedCompany(client, {
      company: {
        tin: '7707083893',
        company_name: 'ООО Пример',
        company_description: 'Описание бизнеса',
        company_research: { provider: 'firecrawl', facts: ['Подтвержденный факт'] },
        website: 'https://example.ru',
        office_qualification: 'More',
        processing_status: 'completed',
      },
      employees: [
        {
          full_name: 'Инна Федина',
          position: 'Директор',
        },
        {
          full_name: 'Иван Иванов',
          position: 'Руководитель ИТ',
          work_email: 'ivan@example.ru',
        },
      ],
    });

    expect(companyTable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        company_name: 'ООО Пример',
        company_research: { provider: 'firecrawl', facts: ['Подтвержденный факт'] },
        processing_status: 'completed',
      })
    );
    expect(employeeTable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: 'existing-company-id',
        full_name: 'Инна Федина',
      })
    );
    expect(employeeTable.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: 'existing-company-id',
        full_name: 'Иван Иванов',
        work_email: 'ivan@example.ru',
      })
    );
    expect(result.company_id).toBe('existing-company-id');
    expect(result.employee_ids).toEqual(['existing-employee-id', 'new-employee-id']);
    expect(result.warnings).toEqual([]);
  });

  it('normalizes high-confidence swapped first and last names during company:save-processed', async () => {
    const companyTable = createCompanyLookup({
      byTin: { '7707083893': { id: 'existing-company-id', tin: '7707083893' } },
    });
    const employeeTable = createProcessedEmployeeTable();
    const repairTable = createEmployeeRepairTable();
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'companies') {
          return {
            select: vi.fn().mockReturnValue({ eq: companyTable.eq }),
            insert: companyTable.insert,
            update: companyTable.update,
          };
        }
        if (table === 'employees') {
          return {
            select: employeeTable.select,
            insert: employeeTable.insert,
            update: employeeTable.update,
          };
        }
        if (table === 'employee_data_repairs') {
          return {
            insert: repairTable.insert,
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await saveProcessedCompany(client, {
      company: {
        tin: '7707083893',
        company_name: 'ООО Пример',
        processing_status: 'completed',
      },
      employees: [
        {
          full_name: 'Инна Федина',
          first_name: 'Федина',
          last_name: 'Инна',
          position: 'Директор',
        },
        {
          full_name: 'Тест Пользователь',
          first_name: 'Пользователь',
          last_name: 'Тест',
          position: 'Руководитель',
        },
      ],
    });

    expect(employeeTable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: 'Инна',
        last_name: 'Федина',
      })
    );
    expect(employeeTable.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: 'Пользователь',
        last_name: 'Тест',
      })
    );
    expect(repairTable.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        employee_id: 'existing-employee-id',
        repair_type: 'name_swap',
        source: 'company:save-processed',
        confidence: 'high',
        original_first_name: 'Федина',
        original_last_name: 'Инна',
        repaired_first_name: 'Инна',
        repaired_last_name: 'Федина',
      }),
    ]);
    expect(result.warnings).toContain(
      'employee name left unchanged for low-confidence repair candidate: Тест Пользователь'
    );
  });

  it('surfaces missing_fields details when processed payload is invalid', async () => {
    const client = {
      from: vi.fn(() => {
        throw new Error('should not hit DB when payload is invalid');
      }),
    } as any;

    await expect(
      saveProcessedCompany(client, {
        company: {
          company_name: '',
          tin: '7707083893',
        },
        employees: [
          {
            full_name: '',
          },
        ],
      })
    ).rejects.toMatchObject({
      code: 'INVALID_PAYLOAD',
      details: {
        missing_fields: expect.arrayContaining(['company.company_name', 'employees[0].full_name']),
      },
    });
  });

  it('marks registration_number dedup as update and warns on TIN mismatch', async () => {
    const companyTable = createCompanyLookup({
      byRegistrationNumber: {
        '1102651000891': {
          id: 'existing-company-id',
          tin: '6325079752',
          registration_number: '1102651000891',
        },
      },
    });
    const employeeTable = createEmployeeTable();
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'companies') {
          return {
            select: vi.fn().mockReturnValue({ eq: companyTable.eq }),
            insert: companyTable.insert,
            update: companyTable.update,
          };
        }
        if (table === 'employees') {
          return {
            select: employeeTable.select,
            insert: employeeTable.insert,
            update: employeeTable.update,
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const preview = await previewCompanyImport(client, [
      {
        company_name: 'ООО "Ясон Агро"',
        tin: '2635800395',
        registration_number: '1102651000891',
        employee_count: 42,
      },
    ]);

    expect(preview.summary.updated_count).toBe(1);
    expect(preview.items[0]).toMatchObject({
      action: 'update',
      match_field: 'registration_number',
    });
    expect(preview.items[0]?.warnings).toContain(
      'TIN mismatch: file=2635800395, db=6325079752'
    );

    const apply = await applyCompanyImport(client, [
      {
        company_name: 'ООО "Ясон Агро"',
        tin: '2635800395',
        registration_number: '1102651000891',
        employee_count: 42,
      },
    ]);

    expect(companyTable.update).toHaveBeenCalled();
    expect(companyTable.insert).not.toHaveBeenCalled();
    expect(apply.summary.updated_count).toBe(1);
    expect(apply.items[0]).toMatchObject({
      action: 'update',
      match_field: 'registration_number',
    });
  });

  it('does not leak the tin filter into registration_number fallback lookups', async () => {
    const employeeTable = createEmployeeTable();
    const insertSelectSingle = vi.fn(async () => ({
      data: { id: 'new-company-id' },
      error: null,
    }));
    const insertSelect = vi.fn().mockReturnValue({ single: insertSelectSingle });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });
    const updateEq = vi.fn(async () => ({ data: [{ id: 'existing-company-id' }], error: null }));
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'companies') {
          let activeFilters: { tin?: string; registration_number?: string } = {};
          const maybeSingle = vi.fn(async () => {
            const tinMatch =
              activeFilters.tin === '2635800395'
                ? null
                : null;
            const registrationMatch =
              activeFilters.registration_number === '1102651000891'
                ? {
                    id: 'existing-company-id',
                    tin: '6325079752',
                    registration_number: '1102651000891',
                  }
                : null;
            const data =
              activeFilters.tin && activeFilters.registration_number
                ? null
                : activeFilters.tin
                  ? tinMatch
                  : activeFilters.registration_number
                    ? registrationMatch
                    : null;
            return { data, error: null };
          });
          const builder = {
            select: vi.fn(),
            eq: vi.fn(),
            insert,
            update,
          } as any;
          builder.select.mockImplementation(() => builder);
          builder.eq.mockImplementation((field: string, value: string) => {
            if (field === 'registration_number') {
              activeFilters.registration_number = value;
            } else {
              activeFilters.tin = value;
            }
            return { maybeSingle, eq: builder.eq };
          });
          return builder;
        }
        if (table === 'employees') {
          return {
            select: employeeTable.select,
            insert: employeeTable.insert,
            update: employeeTable.update,
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const preview = await previewCompanyImport(client, [
      {
        company_name: 'ООО "Ясон Агро"',
        tin: '2635800395',
        registration_number: '1102651000891',
      },
    ]);

    expect(preview.summary.updated_count).toBe(1);
    expect(preview.items[0]).toMatchObject({
      action: 'update',
      match_field: 'registration_number',
    });

    const apply = await applyCompanyImport(client, [
      {
        company_name: 'ООО "Ясон Агро"',
        tin: '2635800395',
        registration_number: '1102651000891',
      },
    ]);

    expect(insert).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
    expect(apply.summary.updated_count).toBe(1);
  });
});

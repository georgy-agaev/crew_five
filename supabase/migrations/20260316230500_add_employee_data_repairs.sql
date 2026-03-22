create table if not exists public.employee_data_repairs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  repair_type text not null,
  source text not null,
  confidence text not null,
  original_first_name varchar(100),
  original_last_name varchar(100),
  repaired_first_name varchar(100),
  repaired_last_name varchar(100),
  applied_at timestamptz not null default now(),
  constraint employee_data_repairs_repair_type_check
    check (repair_type = any (array['name_swap']::text[])),
  constraint employee_data_repairs_source_check
    check (source = any (array['employee:repair-names','company:save-processed']::text[])),
  constraint employee_data_repairs_confidence_check
    check (confidence = any (array['high','low']::text[]))
);

create unique index if not exists employee_data_repairs_unique_repair_idx
  on public.employee_data_repairs (
    employee_id,
    repair_type,
    source,
    coalesce(original_first_name, ''),
    coalesce(original_last_name, ''),
    coalesce(repaired_first_name, ''),
    coalesce(repaired_last_name, '')
  );

create index if not exists employee_data_repairs_employee_idx
  on public.employee_data_repairs (employee_id, applied_at desc);

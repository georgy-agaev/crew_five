alter table public.employees
  add column if not exists work_email_status text not null default 'unknown',
  add column if not exists generic_email_status text not null default 'unknown';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'employees_work_email_status_check'
  ) then
    alter table public.employees
      add constraint employees_work_email_status_check
      check (work_email_status in ('unknown', 'valid', 'invalid', 'bounced'));
  end if;
end $$;

with bounced_recipients as (
  select distinct
    eo.contact_id as employee_id,
    lower(eo.metadata ->> 'recipient_email') as recipient_email
  from public.email_events ev
  join public.email_outbound eo on eo.id = ev.outbound_id
  where ev.event_type = 'bounced'
    and eo.contact_id is not null
    and eo.metadata ->> 'recipient_email' is not null
)
update public.employees e
set work_email_status = 'bounced'
from bounced_recipients br
where e.id = br.employee_id
  and lower(coalesce(e.work_email, '')) = br.recipient_email;

with bounced_recipients as (
  select distinct
    eo.contact_id as employee_id,
    lower(eo.metadata ->> 'recipient_email') as recipient_email
  from public.email_events ev
  join public.email_outbound eo on eo.id = ev.outbound_id
  where ev.event_type = 'bounced'
    and eo.contact_id is not null
    and eo.metadata ->> 'recipient_email' is not null
)
update public.employees e
set generic_email_status = 'bounced'
from bounced_recipients br
where e.id = br.employee_id
  and lower(coalesce(e.generic_email, '')) = br.recipient_email;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'employees_generic_email_status_check'
  ) then
    alter table public.employees
      add constraint employees_generic_email_status_check
      check (generic_email_status in ('unknown', 'valid', 'invalid', 'bounced'));
  end if;
end $$;

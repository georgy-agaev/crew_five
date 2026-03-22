alter table public.icp_profiles
add column if not exists offering_domain text;

update public.icp_profiles
set offering_domain = 'voicexpert.ru'
where offering_domain is null;

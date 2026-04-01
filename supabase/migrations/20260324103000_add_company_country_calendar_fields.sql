alter table public.companies
add column if not exists country_code text,
add column if not exists country_source text;

update public.companies
set
  country_code = upper(trim(region)),
  country_source = coalesce(country_source, 'region_alpha2')
where country_code is null
  and region is not null
  and trim(region) ~ '^[A-Za-z]{2}$';

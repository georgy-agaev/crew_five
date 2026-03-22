alter table public.companies
add column if not exists revenue numeric,
add column if not exists balance numeric,
add column if not exists net_profit_loss numeric,
add column if not exists sme_registry text;

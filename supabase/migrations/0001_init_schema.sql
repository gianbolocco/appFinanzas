-- ============================================================================
-- Guita — Migración inicial: esquema completo + índices + RLS
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_cron" with schema "extensions";

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
do $$ begin
  create type transaction_type as enum ('expense', 'income', 'transfer', 'subscription');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_type as enum ('cash', 'bank', 'credit_card', 'debit_card', 'wallet', 'savings');
exception when duplicate_object then null; end $$;

do $$ begin
  create type category_kind as enum ('expense', 'income', 'transfer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type cadence as enum ('weekly', 'monthly', 'quarterly', 'yearly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transaction_source as enum ('manual', 'bot', 'receipt', 'import');
exception when duplicate_object then null; end $$;

do $$ begin
  create type budget_period as enum ('monthly', 'yearly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type onboarding_step as enum ('profile', 'accounts', 'categories', 'done');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- USERS (perfil, extiende auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  base_currency text not null default 'ARS',
  locale text not null default 'es-AR',
  timezone text not null default 'America/Argentina/Buenos_Aires',
  onboarded boolean not null default false,
  onboarding_step onboarding_step not null default 'profile',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- HOUSEHOLDS (futuro: presupuestos compartidos)
-- ----------------------------------------------------------------------------
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid references public.households(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- ----------------------------------------------------------------------------
-- CATEGORIES (predefinidas + custom, con subcategorías vía parent_id)
-- ----------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  name text not null,
  kind category_kind not null default 'expense',
  parent_id uuid references public.categories(id) on delete cascade,
  icon text,
  color text not null default 'oklch(0.62 0.15 162)',
  "order" int not null default 0,
  is_predefined boolean not null default false,
  created_at timestamptz not null default now(),
  check (user_id is not null or is_predefined = true)
);

-- ----------------------------------------------------------------------------
-- ACCOUNTS (efectivo, banco, tarjetas, billeteras, ahorro)
-- ----------------------------------------------------------------------------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  name text not null,
  type account_type not null default 'cash',
  currency text not null default 'ARS',
  balance numeric(18,2) not null default 0,
  credit_limit numeric(18,2),
  payment_due_date date,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- TRANSACTIONS (gastos, ingresos, transferencias, suscripciones, cuotas)
-- ----------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete set null,
  type transaction_type not null,
  amount numeric(18,2) not null check (amount >= 0),
  currency text not null default 'ARS',
  amount_base numeric(18,2) not null default 0,
  exchange_rate numeric(18,6) not null default 1,
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete cascade,
  to_account_id uuid references public.accounts(id) on delete cascade,
  note text,
  date date not null default current_date,
  source transaction_source not null default 'manual',
  receipt_url text,
  installments_total int,
  installment_number int,
  parent_transaction_id uuid references public.transactions(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (installments_total is null and installment_number is null) or
    (installments_total is not null and installment_number is not null and
     installment_number between 1 and installments_total)
  ),
  check (type <> 'transfer' or to_account_id is not null),
  check (installment_number is null or parent_transaction_id is not null)
);

-- ----------------------------------------------------------------------------
-- TAGS + TRANSACTION_TAGS
-- ----------------------------------------------------------------------------
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.transaction_tags (
  transaction_id uuid references public.transactions(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete cascade,
  primary key (transaction_id, tag_id)
);

-- ----------------------------------------------------------------------------
-- SUBSCRIPTIONS (recurrentes)
-- ----------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  amount numeric(18,2) not null check (amount >= 0),
  currency text not null default 'ARS',
  cadence cadence not null default 'monthly',
  next_date date not null,
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- BUDGETS (mensuales por categoría o global)
-- ----------------------------------------------------------------------------
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  period budget_period not null default 'monthly',
  amount_limit numeric(18,2) not null check (amount_limit >= 0),
  currency text not null default 'ARS',
  created_at timestamptz not null default now(),
  unique (user_id, category_id, period)
);

-- ----------------------------------------------------------------------------
-- GOALS (metas de ahorro)
-- ----------------------------------------------------------------------------
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  target_amount numeric(18,2) not null check (target_amount >= 0),
  current_amount numeric(18,2) not null default 0 check (current_amount >= 0),
  target_date date,
  currency text not null default 'ARS',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- EXCHANGE_RATES (diarios, auto + editables)
-- ----------------------------------------------------------------------------
create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  base text not null,
  quote text not null,
  rate numeric(18,6) not null check (rate > 0),
  date date not null default current_date,
  source text not null default 'auto',
  created_at timestamptz not null default now(),
  unique (base, quote, date)
);

-- ----------------------------------------------------------------------------
-- BOT_LINKS (pareo Telegram)
-- ----------------------------------------------------------------------------
create table if not exists public.bot_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  telegram_chat_id text not null,
  telegram_user_id text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- PAIR_CODES (códigos de un solo uso para vincular Telegram)
-- ----------------------------------------------------------------------------
create table if not exists public.pair_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- ÍNDICES
-- ----------------------------------------------------------------------------
create index if not exists idx_transactions_user_date on public.transactions(user_id, date desc);
create index if not exists idx_transactions_user_type on public.transactions(user_id, type);
create index if not exists idx_transactions_category on public.transactions(category_id);
create index if not exists idx_transactions_account on public.transactions(account_id);
create index if not exists idx_transactions_parent on public.transactions(parent_transaction_id);
create index if not exists idx_accounts_user on public.accounts(user_id);
create index if not exists idx_categories_user on public.categories(user_id);
create index if not exists idx_categories_predefined on public.categories(is_predefined) where is_predefined = true;
create index if not exists idx_budgets_user on public.budgets(user_id);
create index if not exists idx_goals_user on public.goals(user_id);
create index if not exists idx_subscriptions_user on public.subscriptions(user_id);
create index if not exists idx_exchange_rates_lookup on public.exchange_rates(base, quote, date desc);
create index if not exists idx_bot_links_chat on public.bot_links(telegram_chat_id);

-- ----------------------------------------------------------------------------
-- UPDATED_AT TRIGGER (función reutilizable)
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_updated on public.users;
create trigger trg_users_updated before update on public.users
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_accounts_updated on public.accounts;
create trigger trg_accounts_updated before update on public.accounts
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_transactions_updated before update on public.transactions
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- AUTO-CREAR PERFIL DE USUARIO AL REGISTRARSE
-- Nota: sin security definer para evitar error 42P17 en PostgREST.
-- El trigger de auth.users corre con privilegios suficientes.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- RLS — Habilitar en todas las tablas con datos de usuario
-- ----------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.tags enable row level security;
alter table public.transaction_tags enable row level security;
alter table public.subscriptions enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
alter table public.bot_links enable row level security;
alter table public.pair_codes enable row level security;

-- exchange_rates: lectura para todos (anon+auth), escritura solo service_role
alter table public.exchange_rates enable row level security;

-- ----------------------------------------------------------------------------
-- POLÍTICAS RLS — users
-- ----------------------------------------------------------------------------
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own" on public.users
  for insert with check (auth.uid() = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- POLÍTICAS RLS — categories (propias + predefinidas visibles para todos)
-- IMPORTANTE: sin subqueries a household_members para evitar recursion infinita
-- ----------------------------------------------------------------------------
drop policy if exists "categories_select" on public.categories;
create policy "categories_select" on public.categories
  for select using (is_predefined = true or user_id = auth.uid());

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own" on public.categories
  for insert with check (user_id = auth.uid());

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own" on public.categories
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own" on public.categories
  for delete using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- POLÍTICAS RLS — accounts (sin subqueries a household_members)
-- ----------------------------------------------------------------------------
drop policy if exists "accounts_select_own" on public.accounts;
create policy "accounts_select_own" on public.accounts
  for select using (user_id = auth.uid());

drop policy if exists "accounts_insert_own" on public.accounts;
create policy "accounts_insert_own" on public.accounts
  for insert with check (user_id = auth.uid());

drop policy if exists "accounts_update_own" on public.accounts;
create policy "accounts_update_own" on public.accounts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "accounts_delete_own" on public.accounts;
create policy "accounts_delete_own" on public.accounts
  for delete using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- POLÍTICAS RLS — transactions (sin subqueries a household_members)
-- ----------------------------------------------------------------------------
drop policy if exists "tx_select_own" on public.transactions;
create policy "tx_select_own" on public.transactions
  for select using (user_id = auth.uid());

drop policy if exists "tx_insert_own" on public.transactions;
create policy "tx_insert_own" on public.transactions
  for insert with check (user_id = auth.uid());

drop policy if exists "tx_update_own" on public.transactions;
create policy "tx_update_own" on public.transactions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "tx_delete_own" on public.transactions;
create policy "tx_delete_own" on public.transactions
  for delete using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- POLÍTICAS RLS — tags, transaction_tags
-- ----------------------------------------------------------------------------
drop policy if exists "tags_select_own" on public.tags;
create policy "tags_select_own" on public.tags for select using (user_id = auth.uid());

drop policy if exists "tags_insert_own" on public.tags;
create policy "tags_insert_own" on public.tags for insert with check (user_id = auth.uid());

drop policy if exists "tags_update_own" on public.tags;
create policy "tags_update_own" on public.tags for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "tags_delete_own" on public.tags;
create policy "tags_delete_own" on public.tags for delete using (user_id = auth.uid());

drop policy if exists "tx_tags_select" on public.transaction_tags;
create policy "tx_tags_select" on public.transaction_tags for select using (
  exists (select 1 from public.transactions t where t.id = transaction_id and t.user_id = auth.uid())
);

drop policy if exists "tx_tags_insert" on public.transaction_tags;
create policy "tx_tags_insert" on public.transaction_tags for insert with check (
  exists (select 1 from public.transactions t where t.id = transaction_id and t.user_id = auth.uid())
);

drop policy if exists "tx_tags_delete" on public.transaction_tags;
create policy "tx_tags_delete" on public.transaction_tags for delete using (
  exists (select 1 from public.transactions t where t.id = transaction_id and t.user_id = auth.uid())
);

-- ----------------------------------------------------------------------------
-- POLÍTICAS RLS — subscriptions, budgets, goals
-- ----------------------------------------------------------------------------
drop policy if exists "subs_select_own" on public.subscriptions;
create policy "subs_select_own" on public.subscriptions for select using (user_id = auth.uid());

drop policy if exists "subs_insert_own" on public.subscriptions;
create policy "subs_insert_own" on public.subscriptions for insert with check (user_id = auth.uid());

drop policy if exists "subs_update_own" on public.subscriptions;
create policy "subs_update_own" on public.subscriptions for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "subs_delete_own" on public.subscriptions;
create policy "subs_delete_own" on public.subscriptions for delete using (user_id = auth.uid());

drop policy if exists "budgets_select_own" on public.budgets;
create policy "budgets_select_own" on public.budgets for select using (user_id = auth.uid());

drop policy if exists "budgets_insert_own" on public.budgets;
create policy "budgets_insert_own" on public.budgets for insert with check (user_id = auth.uid());

drop policy if exists "budgets_update_own" on public.budgets;
create policy "budgets_update_own" on public.budgets for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "budgets_delete_own" on public.budgets;
create policy "budgets_delete_own" on public.budgets for delete using (user_id = auth.uid());

drop policy if exists "goals_select_own" on public.goals;
create policy "goals_select_own" on public.goals for select using (user_id = auth.uid());

drop policy if exists "goals_insert_own" on public.goals;
create policy "goals_insert_own" on public.goals for insert with check (user_id = auth.uid());

drop policy if exists "goals_update_own" on public.goals;
create policy "goals_update_own" on public.goals for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "goals_delete_own" on public.goals;
create policy "goals_delete_own" on public.goals for delete using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- POLÍTICAS RLS — households, household_members
-- IMPORTANTE: sin subqueries recursivas — solo comparación directa por user_id/created_by
-- ----------------------------------------------------------------------------
drop policy if exists "households_select_member" on public.households;
create policy "households_select_member" on public.households
  for select using (created_by = auth.uid());

drop policy if exists "households_insert_own" on public.households;
create policy "households_insert_own" on public.households
  for insert with check (created_by = auth.uid());

drop policy if exists "households_update_own" on public.households;
create policy "households_update_own" on public.households
  for update using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists "households_delete_own" on public.households;
create policy "households_delete_own" on public.households
  for delete using (created_by = auth.uid());

drop policy if exists "hm_select_member" on public.household_members;
create policy "hm_select_member" on public.household_members
  for select using (user_id = auth.uid());

drop policy if exists "hm_insert_own" on public.household_members;
create policy "hm_insert_own" on public.household_members
  for insert with check (user_id = auth.uid());

drop policy if exists "hm_delete_own" on public.household_members;
create policy "hm_delete_own" on public.household_members
  for delete using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- POLÍTICAS RLS — exchange_rates (lectura pública, escritura service_role)
-- ----------------------------------------------------------------------------
drop policy if exists "rates_select_all" on public.exchange_rates;
create policy "rates_select_all" on public.exchange_rates
  for select to anon, authenticated using (true);

-- ----------------------------------------------------------------------------
-- POLÍTICAS RLS — bot_links, pair_codes
-- ----------------------------------------------------------------------------
drop policy if exists "bot_links_select_own" on public.bot_links;
create policy "bot_links_select_own" on public.bot_links for select using (user_id = auth.uid());

drop policy if exists "bot_links_insert_own" on public.bot_links;
create policy "bot_links_insert_own" on public.bot_links for insert with check (user_id = auth.uid());

drop policy if exists "bot_links_delete_own" on public.bot_links;
create policy "bot_links_delete_own" on public.bot_links for delete using (user_id = auth.uid());

drop policy if exists "pair_codes_select_own" on public.pair_codes;
create policy "pair_codes_select_own" on public.pair_codes for select using (user_id = auth.uid());

drop policy if exists "pair_codes_insert_own" on public.pair_codes;
create policy "pair_codes_insert_own" on public.pair_codes for insert with check (user_id = auth.uid());

drop policy if exists "pair_codes_delete_own" on public.pair_codes;
create policy "pair_codes_delete_own" on public.pair_codes for delete using (user_id = auth.uid());

-- ============================================================================
-- SEED — categorías predefinidas (ES)
-- ============================================================================
insert into public.categories (name, kind, icon, color, "order", is_predefined) values
  ('Comida',          'expense', 'utensils',   'oklch(0.62 0.15 162)', 1,  true),
  ('Transporte',      'expense', 'car',        'oklch(0.65 0.15 240)', 2,  true),
  ('Vivienda',        'expense', 'home',       'oklch(0.6 0.2 300)',   3,  true),
  ('Servicios',       'expense', 'zap',        'oklch(0.75 0.15 80)',  4,  true),
  ('Ocio',            'expense', 'gamepad-2',  'oklch(0.7 0.2 15)',    5,  true),
  ('Salud',           'expense', 'heart-pulse','oklch(0.62 0.22 15)',  6,  true),
  ('Ropa',            'expense', 'shirt',      'oklch(0.68 0.2 300)',  7,  true),
  ('Educación',       'expense', 'book-open',  'oklch(0.65 0.15 240)', 8,  true),
  ('Mascotas',        'expense', 'paw-print',  'oklch(0.72 0.15 60)',  9,  true),
  ('Regalos',         'expense', 'gift',       'oklch(0.7 0.2 15)',    10, true),
  ('Otros gastos',    'expense', 'circle-ellipsis', 'oklch(0.556 0 0)', 99, true),
  ('Sueldo',          'income',  'banknote',   'oklch(0.62 0.15 162)', 1,  true),
  ('Freelance',       'income',  'laptop',     'oklch(0.62 0.15 162)', 2,  true),
  ('Ventas',          'income',  'shopping-bag','oklch(0.62 0.15 162)',3,  true),
  ('Inversiones',     'income',  'trending-up','oklch(0.62 0.15 162)', 4,  true),
  ('Otros ingresos',  'income',  'circle-plus','oklch(0.62 0.15 162)', 99, true)
on conflict do nothing;

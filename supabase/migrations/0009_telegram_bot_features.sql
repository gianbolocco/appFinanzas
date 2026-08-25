-- Agregamos la columna a la tabla accounts
alter table public.accounts add column if not exists is_default boolean not null default false;

-- Tabla para almacenar los gastos temporalmente hasta que se confirmen
create table if not exists public.pending_bot_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  telegram_chat_id text not null,
  type text not null,
  amount numeric not null,
  currency text not null,
  date date not null,
  description text,
  category_id uuid not null references public.categories(id),
  account_id uuid not null references public.accounts(id),
  created_at timestamptz not null default now()
);

-- Indice para limpieza rápida (ej: borrar los no confirmados después de 24hs si hiciera falta)
create index if not exists idx_pending_bot_created on public.pending_bot_transactions(created_at);

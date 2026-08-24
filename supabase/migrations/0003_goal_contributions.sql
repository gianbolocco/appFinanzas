-- ============================================================================
-- Guita — Migración 0003: aportes de metas + RLS
-- ============================================================================

-- Tabla para registrar aportes individuales a metas de ahorro
create table if not exists public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  amount numeric(18,2) not null check (amount > 0),
  transaction_id uuid references public.transactions(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_goal_contributions_goal on public.goal_contributions(goal_id);

-- RLS
alter table public.goal_contributions enable row level security;

drop policy if exists "gc_select_own" on public.goal_contributions;
create policy "gc_select_own" on public.goal_contributions
  for select using (user_id = auth.uid());

drop policy if exists "gc_insert_own" on public.goal_contributions;
create policy "gc_insert_own" on public.goal_contributions
  for insert with check (user_id = auth.uid());

drop policy if exists "gc_delete_own" on public.goal_contributions;
create policy "gc_delete_own" on public.goal_contributions
  for delete using (user_id = auth.uid());

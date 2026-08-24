-- ============================================================================
-- Guita — Migración 0004: vincular transacciones con suscripciones
-- ============================================================================

-- Agregar subscription_id a transactions para追踪ar pagos de suscripciones
alter table public.transactions
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null;

create index if not exists idx_transactions_subscription on public.transactions(subscription_id)
  where subscription_id is not null;

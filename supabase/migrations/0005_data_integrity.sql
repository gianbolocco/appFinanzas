-- ============================================================================
-- Guita — Migración 0005: integridad de transferencias, cuotas, metas y pagos
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Columnas nuevas
-- ----------------------------------------------------------------------------

-- Monto acreditado en la cuenta destino de una transferencia.
-- Permite guardar la transferencia como UNA fila aunque las monedas difieran:
-- `amount` queda en la moneda del origen, `dest_amount` en la del destino.
alter table public.transactions
  add column if not exists dest_amount numeric(18,2);

-- Vincula una transacción con la meta de ahorro que la originó.
-- Espejo del patrón ya usado por subscription_id (migración 0004).
alter table public.transactions
  add column if not exists goal_id uuid references public.goals(id) on delete set null;

-- El "padre" de una compra en cuotas: lleva el monto total y ninguna cuota.
-- No debe listarse ni sumarse nunca; solo sirve para reconstruir la compra.
alter table public.transactions
  add column if not exists is_installment_parent boolean
    generated always as (installments_total is not null and installment_number is null) stored;

-- ----------------------------------------------------------------------------
-- 2. Backfill: colapsar los pares expense+income en una sola fila transfer
-- ----------------------------------------------------------------------------
-- Hasta ahora una transferencia se guardaba como dos filas creadas por
-- createTransaction, reconocibles por sus notas y sus cuentas cruzadas.
-- Idempotente: al terminar no quedan filas que matcheen el patrón.

with pares as (
  select
    e.id     as expense_id,
    i.id     as income_id,
    i.amount as dest_amount
  from public.transactions e
  join public.transactions i
    on  i.user_id       = e.user_id
    and i.date          = e.date
    and i.account_id    = e.to_account_id
    and i.to_account_id = e.account_id
    and i.type          = 'income'
    and i.note like 'Transfer ←%'
  where e.type = 'expense'
    and e.to_account_id is not null
    and e.note like 'Transfer →%'
),
actualizadas as (
  update public.transactions t
     set type        = 'transfer',
         dest_amount = p.dest_amount
    from pares p
   where t.id = p.expense_id
  returning p.income_id
)
delete from public.transactions
 where id in (select income_id from actualizadas);

-- Cualquier transferencia preexistente que ya fuera type='transfer'
-- (no debería haber ninguna) queda con dest_amount = amount.
update public.transactions
   set dest_amount = amount
 where type = 'transfer'
   and dest_amount is null;

-- ----------------------------------------------------------------------------
-- 3. Constraints (después del backfill, para que los datos viejos los cumplan)
-- ----------------------------------------------------------------------------

alter table public.transactions
  drop constraint if exists transactions_transfer_needs_dest_amount;

alter table public.transactions
  add constraint transactions_transfer_needs_dest_amount
  check (type <> 'transfer' or dest_amount is not null);

-- ----------------------------------------------------------------------------
-- 4. Índices
-- ----------------------------------------------------------------------------

create index if not exists idx_transactions_goal
  on public.transactions(goal_id) where goal_id is not null;

-- Cubre la consulta más frecuente: movimientos del usuario por fecha,
-- excluyendo los padres de cuotas.
create index if not exists idx_transactions_listable
  on public.transactions(user_id, date desc) where is_installment_parent = false;

-- Idempotencia del registro de pagos: un pago por suscripción por día.
-- Es la base la que lo garantiza, no el código de aplicación.
create unique index if not exists uq_subscription_payment_per_day
  on public.transactions(subscription_id, date) where subscription_id is not null;

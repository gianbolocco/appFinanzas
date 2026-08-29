-- ============================================================================
-- Guita — Migración 0012: separar saldo de apertura del saldo corriente
-- ============================================================================
-- `accounts.balance` mezclaba dos cosas: el saldo con el que se abrió la cuenta
-- y el efecto acumulado de los movimientos. Al estar en el mismo campo, el saldo
-- no se podía recomputar desde las transacciones y por lo tanto ningún error de
-- saldo era detectable.
--
-- Con la apertura guardada aparte, `apertura + movimientos` es un invariante
-- chequeable y la app puede avisar cuando el saldo guardado no cierra.

alter table public.accounts
  add column if not exists opening_balance numeric(18,2) not null default 0;

-- Backfill: apertura = saldo actual − efecto de los movimientos ya aplicados.
-- Idempotente: ni el saldo ni los movimientos cambian al correrlo de nuevo.
--
-- Las reglas replican exactamente lo que hace la app al escribir:
--   · income suma, expense y transfer restan sobre la cuenta origen;
--   · la cuenta destino de una transferencia recibe dest_amount (su moneda);
--   · el padre de una compra en cuotas no mueve saldo;
--   · una cuota mueve saldo recién cuando vence.
with movimientos as (
  select
    a.id as account_id,
    coalesce(sum(
      case
        when t.type = 'income' then t.amount
        else -t.amount
      end
    ), 0) as salidas,
    coalesce((
      select sum(coalesce(t2.dest_amount, t2.amount))
      from public.transactions t2
      where t2.to_account_id = a.id
        and t2.type = 'transfer'
        and t2.is_installment_parent = false
    ), 0) as entradas
  from public.accounts a
  left join public.transactions t
    on t.account_id = a.id
   and t.is_installment_parent = false
   and (t.installment_number is null or t.date <= current_date)
  group by a.id
)
update public.accounts a
   set opening_balance = a.balance - (m.salidas + m.entradas)
  from movimientos m
 where m.account_id = a.id;

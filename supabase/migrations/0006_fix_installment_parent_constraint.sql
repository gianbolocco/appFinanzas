-- ============================================================================
-- Guita — Migración 0006: permitir el padre de una cuota
-- ============================================================================
-- La migración 0001 exigía installments_total e installment_number ambos
-- null o ambos seteados. Eso deja irrepresentable el padre de una compra en
-- cuotas (installments_total seteado, installment_number null), que
-- is_installment_parent (migración 0005) da por hecho. Sin este fix, todo
-- intento de crear una compra en cuotas viola el constraint.

alter table public.transactions
  drop constraint if exists transactions_check;

alter table public.transactions
  add constraint transactions_check
  check (
    installment_number is null or
    (installments_total is not null and installment_number between 1 and installments_total)
  );

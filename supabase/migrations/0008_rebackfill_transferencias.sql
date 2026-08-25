-- Backfill de transferencias rezagadas creadas por la rama main
-- antes de mergear la rama fixes-datos-y-ux.

with expense_ranked as (
  select
    id, user_id, date, account_id, to_account_id,
    row_number() over (
      partition by user_id, date, account_id, to_account_id
      order by created_at
    ) as rn
  from public.transactions
  where type = 'expense'
    and to_account_id is not null
    and note like 'Transfer →%'
),
income_ranked as (
  select
    id, user_id, date, account_id, to_account_id, amount as dest_amount,
    row_number() over (
      partition by user_id, date, account_id, to_account_id
      order by created_at
    ) as rn
  from public.transactions
  where type = 'income'
    and note like 'Transfer ←%'
),
pares as (
  select
    e.id as expense_id,
    i.id as income_id,
    i.dest_amount
  from expense_ranked e
  join income_ranked i
    on  i.user_id       = e.user_id
    and i.date          = e.date
    and i.account_id    = e.to_account_id
    and i.to_account_id = e.account_id
    and i.rn             = e.rn
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

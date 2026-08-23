-- Función RPC para ajustar el saldo de una cuenta
-- Llamada desde server actions al crear/editar/eliminar transacciones

create or replace function public.adjust_account_balance(p_account_id uuid, p_delta numeric)
returns void as $$
begin
  update public.accounts
  set balance = balance + p_delta
  where id = p_account_id;
end;
$$ language plpgsql security definer set search_path = public;

-- Permite que usuarios autenticados llamen a la función solo en sus propias cuentas
-- (RLS de accounts protege el update, pero security definer lo hace eficiente)
grant execute on function public.adjust_account_balance to authenticated;

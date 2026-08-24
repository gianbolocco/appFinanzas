-- Migración 0002 (corregida): removemos el RPC con security definer
-- El ajuste de saldo se hace con UPDATE directo desde el server action (RLS lo permite)

-- Limpiar función anterior si fue creada
drop function if exists public.adjust_account_balance(uuid, numeric);

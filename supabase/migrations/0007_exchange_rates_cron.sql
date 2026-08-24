-- ============================================================================
-- Guita — Migración 0007: cotizaciones diarias vía pg_cron
-- ============================================================================
-- Requiere que existan estos secrets en Vault (creados a mano, nunca en el repo):
--   select vault.create_secret('<service-role-key>', 'service_role_key');
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- Reprogramar es seguro: si el job ya existe se reemplaza.
select cron.unschedule('exchange-rates-daily')
 where exists (select 1 from cron.job where jobname = 'exchange-rates-daily');

-- 09:00 UTC = 06:00 en Argentina. El body se evalúa en cada corrida,
-- así que la key se lee de Vault al momento de ejecutar, no al programar.
select cron.schedule(
  'exchange-rates-daily',
  '0 9 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/exchange-rates-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

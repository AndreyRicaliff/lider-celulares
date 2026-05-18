-- Primeiro, removemos o job antigo se ele existir
SELECT cron.unschedule('sync-tenfront-every-2h');

-- Criamos o novo job com o intervalo de 4 horas
SELECT cron.schedule(
  'sync-tenfront-every-4h',
  '0 */4 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://rtbybgrvpzhaqzaouemh.supabase.co/functions/v1/sync-tenfront',
      headers:=jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
      body:=jsonb_build_object()
    ) as request_id;
  $$
);
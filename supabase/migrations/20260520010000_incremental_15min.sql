-- Incrementa intervalo do sync de 10 para 15 minutos.
-- Motivo: cada incremental busca 2 dias de dados (lastSyncDate-1d até hoje),
-- o que consome ~3 chamadas Tenfront por run. A 10min: ~280 chamadas/dia/loja
-- com margem de apenas 16% sobre o limite de 350. A 15min: ~195 chamadas/dia,
-- margem de 44% — seguro mesmo no final do mês quando o volume é maior.

SELECT cron.unschedule('sync-tenfront-incremental');
SELECT cron.schedule(
  'sync-tenfront-incremental',
  '*/15 8-22 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ibpcexyrxwmknrfwifyy.supabase.co/functions/v1/sync-tenfront',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlicGNleHlyeHdta25yZndpZnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjUzNDcsImV4cCI6MjA5NDYwMTM0N30.noVxEIHwpeaSNiaaV7VG5ZzmJqJYXFrBLgh_8w_eDFY'
    ),
    body    := '{"force": false}'::jsonb
  ) AS request_id
  $$
);

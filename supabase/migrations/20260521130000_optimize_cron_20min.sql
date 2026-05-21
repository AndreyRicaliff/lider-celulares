-- Otimização: saldo check único por ciclo economiza 4 calls/ciclo.
-- Intervalo aumentado para 20 min: 36 ciclos × ~7 calls = ~252 calls/dia (cabe em 350).
SELECT cron.unschedule(jobname) FROM cron.job;

SELECT cron.schedule(
  'sync-tenfront-incremental',
  '*/20 12-23 * * 1-6',
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

SELECT cron.schedule(
  'sync-tenfront-full-year',
  '0 21 * * 0',
  $$
  SELECT net.http_post(
    url     := 'https://ibpcexyrxwmknrfwifyy.supabase.co/functions/v1/sync-tenfront',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlicGNleHlyeHdta25yZndpZnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjUzNDcsImV4cCI6MjA5NDYwMTM0N30.noVxEIHwpeaSNiaaV7VG5ZzmJqJYXFrBLgh_8w_eDFY'
    ),
    body    := '{"fullYear": true}'::jsonb
  ) AS request_id
  $$
);

-- Cron diário do snapshot de estoque (estoque muda devagar; 1x/dia basta).
-- 05:00 UTC = 02:00 BRT — fora do horário comercial, quota da loja fresca.
-- NÃO faz unschedule de outros jobs (preserva os crons de sync-tenfront).
-- cron.schedule faz upsert por jobname (re-rodar é idempotente).
SELECT cron.schedule(
  'sync-estoque-daily',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ibpcexyrxwmknrfwifyy.supabase.co/functions/v1/sync-estoque',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlicGNleHlyeHdta25yZndpZnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjUzNDcsImV4cCI6MjA5NDYwMTM0N30.noVxEIHwpeaSNiaaV7VG5ZzmJqJYXFrBLgh_8w_eDFY'
    ),
    body    := '{}'::jsonb
  ) AS request_id
  $$
);

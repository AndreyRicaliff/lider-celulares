-- Estratégia de 2 grupos com janelas distintas:
--   Grupo A (Caruaru, Campina Grande, Natal): 10h–23h BRT = 13h–02h UTC
--   Grupo B (Monteiro, Soledade):             08h–20h BRT = 11h–23h UTC
-- Intervalo: 30 min. Consumo estimado: ~252 calls/dia (limite 350).

SELECT cron.unschedule(jobname) FROM cron.job;

-- Grupo A — horário diurno: 10h–20h30 BRT (13h–23h30 UTC)
SELECT cron.schedule(
  'sync-group-a-day',
  '*/30 13-23 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ibpcexyrxwmknrfwifyy.supabase.co/functions/v1/sync-tenfront',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlicGNleHlyeHdta25yZndpZnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjUzNDcsImV4cCI6MjA5NDYwMTM0N30.noVxEIHwpeaSNiaaV7VG5ZzmJqJYXFrBLgh_8w_eDFY'
    ),
    body    := '{"loja_ids": ["caruaru", "campina-grande", "natal"]}'::jsonb
  ) AS request_id
  $$
);

-- Grupo A — horário noturno: 21h–23h BRT (00h–02h UTC)
SELECT cron.schedule(
  'sync-group-a-night',
  '0,30 0-2 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ibpcexyrxwmknrfwifyy.supabase.co/functions/v1/sync-tenfront',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlicGNleHlyeHdta25yZndpZnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjUzNDcsImV4cCI6MjA5NDYwMTM0N30.noVxEIHwpeaSNiaaV7VG5ZzmJqJYXFrBLgh_8w_eDFY'
    ),
    body    := '{"loja_ids": ["caruaru", "campina-grande", "natal"]}'::jsonb
  ) AS request_id
  $$
);

-- Grupo B — 08h–20h30 BRT (11h–23h30 UTC)
SELECT cron.schedule(
  'sync-group-b',
  '*/30 11-23 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ibpcexyrxwmknrfwifyy.supabase.co/functions/v1/sync-tenfront',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlicGNleHlyeHdta25yZndpZnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjUzNDcsImV4cCI6MjA5NDYwMTM0N30.noVxEIHwpeaSNiaaV7VG5ZzmJqJYXFrBLgh_8w_eDFY'
    ),
    body    := '{"loja_ids": ["monteiro", "soledade"]}'::jsonb
  ) AS request_id
  $$
);

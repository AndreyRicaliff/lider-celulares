-- Sync anual todo domingo às 18h BRT (21:00 UTC).
--
-- A edge function agora aceita fullYear:true e processa os meses do ano
-- corrente do mais recente para o mais antigo, dentro de um budget de 110s.
-- Meses mais antigos que não couberem serão cobertos no domingo seguinte.
--
-- No domingo, o incremental é pausado (dom não entra em 1-6).
-- Consumo estimado por loja num domingo de dezembro (pior caso):
--   annual (11 meses × ~15 pág) = 165 chamadas
--   day-close 00:00 UTC         =  15 chamadas
--   full-daily 03:10 UTC        =  11 chamadas
--   Total                       = 191 de 350   (margem 45%)

-- Incremental: segunda a sábado apenas (domingo coberto pelo annual)
SELECT cron.unschedule('sync-tenfront-incremental');
SELECT cron.schedule(
  'sync-tenfront-incremental',
  '*/15 11-23 * * 1-6',
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

-- Annual: todo domingo 18h BRT (21:00 UTC)
SELECT cron.schedule(
  'sync-tenfront-annual',
  '0 21 * * 0',
  $$
  SELECT net.http_post(
    url     := 'https://ibpcexyrxwmknrfwifyy.supabase.co/functions/v1/sync-tenfront',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlicGNleHlyeHdta25yZndpZnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjUzNDcsImV4cCI6MjA5NDYwMTM0N30.noVxEIHwpeaSNiaaV7VG5ZzmJqJYXFrBLgh_8w_eDFY'
    ),
    body    := '{"fullYear": true, "force": true}'::jsonb
  ) AS request_id
  $$
);

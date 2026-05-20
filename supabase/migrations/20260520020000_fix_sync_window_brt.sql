-- Alinha janela de sync ao horário de Brasília (BRT = UTC-3).
--
-- Problema: incremental anterior usava 8-22 UTC = 5h-20h BRT (errado).
-- Correto: 8h-21h BRT = 11h-00h UTC.
--
-- Novo schedule:
--   sync-tenfront-incremental  */15 11-23 UTC  (8h-8h45pm BRT, a cada 15min)
--   sync-tenfront-day-close    0 0 UTC         (21h BRT, force — fecha o dia)
--   sync-tenfront-full-daily   10 3 UTC        (00h10 BRT, pós-reset da cota)
--
-- Consumo estimado por dia/loja:
--   52 runs × 3 chamadas  = 156  (incremental)
--   1 run   × 15 chamadas = 15   (day-close)
--   1 run   × 11 chamadas = 11   (full-daily)
--   Total ≈ 182 de 350    = 48% da cota  (margem 46%)
--
-- Taxa mínima possível: 10 min (~260 chamadas/dia = 78%, margem 22%)

SELECT cron.unschedule('sync-tenfront-incremental');
SELECT cron.schedule(
  'sync-tenfront-incremental',
  '*/15 11-23 * * *',
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

-- Fechamento do dia: 21h BRT (00:00 UTC) — captura histórico diário completo
SELECT cron.schedule(
  'sync-tenfront-day-close',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ibpcexyrxwmknrfwifyy.supabase.co/functions/v1/sync-tenfront',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlicGNleHlyeHdta25yZndpZnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjUzNDcsImV4cCI6MjA5NDYwMTM0N30.noVxEIHwpeaSNiaaV7VG5ZzmJqJYXFrBLgh_8w_eDFY'
    ),
    body    := '{"force": true}'::jsonb
  ) AS request_id
  $$
);

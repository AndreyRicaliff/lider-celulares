-- Correção: reset do limite Tenfront ocorre à meia-noite BRT (03:00 UTC), não UTC midnight.
-- O sync-tenfront-evening rodava 00:00-01:50 UTC (21:00-22:50 BRT) = PRÉ-reset → desperdiçava quota.
-- O full-daily estava em 00:10 UTC (21:10 BRT) = também pré-reset.
--
-- Estado correto após esta migration:
--   sync-tenfront-incremental  */10 8-22 * * *   (08:00–22:50 UTC = 05:00–19:50 BRT)
--   sync-tenfront-full-daily   10 3 * * *         (03:10 UTC = 00:10 BRT, pós-reset)

-- Remove cron pré-reset que desperdiçava quota
SELECT cron.unschedule('sync-tenfront-evening');

-- Reposiciona full-daily para 03:10 UTC (0:10 BRT), logo após o reset
SELECT cron.unschedule('sync-tenfront-full-daily');
SELECT cron.schedule(
  'sync-tenfront-full-daily',
  '10 3 * * *',
  $$ SELECT net.http_post(
    url := 'https://rtbybgrvpzhaqzaouemh.supabase.co/functions/v1/sync-tenfront',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) $$
);

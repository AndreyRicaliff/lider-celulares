-- Garante que a extensão pg_cron e pg_net estão ativadas
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Agenda a sincronização a cada 2 horas
-- Nota: A URL usa o endpoint da Edge Function sync-tenfront
SELECT cron.schedule(
  'sync-tenfront-auto',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rtbybgrvpzhaqzaouemh.supabase.co/functions/v1/sync-tenfront',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);

-- Permissões básicas se necessário (opcional, dependendo do ambiente)
-- GRANT USAGE ON SCHEMA cron TO postgres;

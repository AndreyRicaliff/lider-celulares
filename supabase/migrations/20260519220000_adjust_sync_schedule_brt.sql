-- Ajuste do schedule de sync para horário de Brasília (UTC-3)
-- Reset do limite Tenfront: 00:00 UTC = 21:00 BRT
--
-- Estratégia:
--   - Incremental diurno:  05:00–19:50 BRT  (08:00–22:50 UTC) — horário de expediente
--   - Burst pós-reset:     21:00–22:50 BRT  (00:00–01:50 UTC) — captura fechamento do caixa
--   - Full-daily:          21:10 BRT        (00:10 UTC)       — 1ª sync completa após reset
--
-- Removido: sync-tenfront-monthly (23:00 UTC = 20:00 BRT)
--   Era um full-fetch que consumia quota pré-reset sem necessidade.

-- Remove o monthly que desperdiça quota pré-reset
SELECT cron.unschedule('sync-tenfront-monthly');

-- Estende o incremental diurno até 22:50 UTC (19:50 BRT) — sem mudança na faixa atual
-- (já era */10 8-22, cobre até 22:50 UTC = 19:50 BRT — mantém)

-- Adiciona burst pós-reset: 00:00–01:50 UTC = 21:00–22:50 BRT
-- Captura os últimos lançamentos do expediente com quota zerada
SELECT cron.unschedule('sync-tenfront-evening');  -- caso exista de tentativa anterior
SELECT cron.schedule(
  'sync-tenfront-evening',
  '*/10 0-1 * * *',
  $$ SELECT net.http_post(
    url := 'https://rtbybgrvpzhaqzaouemh.supabase.co/functions/v1/sync-tenfront',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) $$
);

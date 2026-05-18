-- Remover agendamentos antigos para evitar duplicidade
SELECT cron.unschedule('sync-tenfront-30min');
SELECT cron.unschedule('sync-tenfront-auto');

-- Agendamento para Natal, Campina e Caruaru (Lojas que abrem às 10:00)
-- Horários solicitados: 12:00, 15:00, 18:00, 21:00, 22:30
-- Usaremos nomes distintos para cada horário para facilitar o controle

-- 12:00
SELECT cron.schedule(
  'sync-tenfront-1200',
  '0 12 * * *',
  $$ SELECT net.http_post(url := 'https://rtbybgrvpzhaqzaouemh.supabase.co/functions/v1/sync-tenfront', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb) $$
);

-- 15:00
SELECT cron.schedule(
  'sync-tenfront-1500',
  '0 15 * * *',
  $$ SELECT net.http_post(url := 'https://rtbybgrvpzhaqzaouemh.supabase.co/functions/v1/sync-tenfront', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb) $$
);

-- 18:00
SELECT cron.schedule(
  'sync-tenfront-1800',
  '0 18 * * *',
  $$ SELECT net.http_post(url := 'https://rtbybgrvpzhaqzaouemh.supabase.co/functions/v1/sync-tenfront', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb) $$
);

-- 21:00
SELECT cron.schedule(
  'sync-tenfront-2100',
  '0 21 * * *',
  $$ SELECT net.http_post(url := 'https://rtbybgrvpzhaqzaouemh.supabase.co/functions/v1/sync-tenfront', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb) $$
);

-- 22:30
SELECT cron.schedule(
  'sync-tenfront-2230',
  '30 22 * * *',
  $$ SELECT net.http_post(url := 'https://rtbybgrvpzhaqzaouemh.supabase.co/functions/v1/sync-tenfront', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb) $$
);

-- Agendamento para Monteiro e Soledade (Lojas que abrem às 08:00)
-- Horários solicitados: 10:00, 12:00 (já agendado), 14:00, 16:00, 18:00 (já agendado), 20:00, 22:00

-- 10:00
SELECT cron.schedule(
  'sync-tenfront-1000',
  '0 10 * * *',
  $$ SELECT net.http_post(url := 'https://rtbybgrvpzhaqzaouemh.supabase.co/functions/v1/sync-tenfront', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb) $$
);

-- 14:00
SELECT cron.schedule(
  'sync-tenfront-1400',
  '0 14 * * *',
  $$ SELECT net.http_post(url := 'https://rtbybgrvpzhaqzaouemh.supabase.co/functions/v1/sync-tenfront', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb) $$
);

-- 16:00
SELECT cron.schedule(
  'sync-tenfront-1600',
  '0 16 * * *',
  $$ SELECT net.http_post(url := 'https://rtbybgrvpzhaqzaouemh.supabase.co/functions/v1/sync-tenfront', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb) $$
);

-- 20:00
SELECT cron.schedule(
  'sync-tenfront-2000',
  '0 20 * * *',
  $$ SELECT net.http_post(url := 'https://rtbybgrvpzhaqzaouemh.supabase.co/functions/v1/sync-tenfront', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb) $$
);

-- 22:00
SELECT cron.schedule(
  'sync-tenfront-2200',
  '0 22 * * *',
  $$ SELECT net.http_post(url := 'https://rtbybgrvpzhaqzaouemh.supabase.co/functions/v1/sync-tenfront', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb) $$
);
-- Ativa a extensão pg_cron se não estiver ativa
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agenda a sincronização das lojas de 1 em 1 hora
-- O comando chama a Edge Function 'sync-tenfront'
-- Nota: O service_role_key deve estar configurado no ambiente para que o net.http_post funcione se a função for protegida.
-- Para simplificar e garantir funcionamento, agendamos o disparo.
SELECT cron.schedule('sync-tenfront-hourly', '0 * * * *', $$
  SELECT
    net.http_post(
      url:='https://rtbybgrvpzhaqzaouemh.supabase.co/functions/v1/sync-tenfront',
      headers:='{"Content-Type": "application/json"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
$$);
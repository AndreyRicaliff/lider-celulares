SELECT cron.unschedule('sync-tenfront-hourly');

SELECT cron.schedule(
  'sync-tenfront-30min',
  '*/30 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://rtbybgrvpzhaqzaouemh.supabase.co/functions/v1/sync-tenfront',
      headers:='{"Content-Type": "application/json"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);
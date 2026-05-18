ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS tenfront_bearer_token TEXT,
  ADD COLUMN IF NOT EXISTS tenfront_consumer_key TEXT,
  ADD COLUMN IF NOT EXISTS tenfront_consumer_secret TEXT;

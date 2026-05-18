ALTER TABLE public.lojas 
ADD COLUMN IF NOT EXISTS tenfront_api_key TEXT,
ADD COLUMN IF NOT EXISTS tenfront_stock_token TEXT;

-- Update RLS if needed, but usually it follows the table's RLS.
-- Since this is an admin feature, I'll assume only admins can edit these.

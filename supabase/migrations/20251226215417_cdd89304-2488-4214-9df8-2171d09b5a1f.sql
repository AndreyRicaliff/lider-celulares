-- Allow loja_id to be nullable for supervisors
ALTER TABLE public.colaboradores ALTER COLUMN loja_id DROP NOT NULL;

-- Add a check constraint to ensure loja_id is required for non-supervisors
-- We'll handle this at the application level instead to avoid complexity
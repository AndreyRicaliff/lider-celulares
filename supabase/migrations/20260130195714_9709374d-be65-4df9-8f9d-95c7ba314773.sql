
-- Add column to allow manager-level access for collaborators who aren't managers
ALTER TABLE public.colaboradores 
ADD COLUMN acesso_gerente BOOLEAN NOT NULL DEFAULT false;

-- Set Raniel as having manager access
UPDATE public.colaboradores 
SET acesso_gerente = true 
WHERE id = '6ff199bd-408b-4518-b373-dd5f7a6b8516';

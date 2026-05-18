-- Add regiao column
ALTER TABLE public.tabela_precos ADD COLUMN IF NOT EXISTS regiao TEXT DEFAULT 'PB';

-- Update unique index to include regiao
DROP INDEX IF EXISTS idx_tabela_precos_modelo_memoria;
CREATE UNIQUE INDEX idx_tabela_precos_modelo_regiao ON public.tabela_precos (modelo, memoria, regiao);

-- Adicionar coluna loja_id na tabela dividas para associar dívidas a lojas específicas
ALTER TABLE public.dividas ADD COLUMN loja_id text NULL;

-- Criar índice para melhor performance nas buscas por loja
CREATE INDEX idx_dividas_loja_id ON public.dividas(loja_id);
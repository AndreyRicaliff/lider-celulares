-- Deleta registros duplicados mantendo apenas o mais recente (maior created_at ou ID)
DELETE FROM public.vendas v1
USING public.vendas v2
WHERE v1.id < v2.id
  AND v1.loja_id = v2.loja_id
  AND v1.vendedor_nome = v2.vendedor_nome
  AND v1.mes = v2.mes;

-- Adiciona a restrição de unicidade
ALTER TABLE public.vendas 
ADD CONSTRAINT vendas_loja_mes_vendedor_unique UNIQUE (loja_id, mes, vendedor_nome);
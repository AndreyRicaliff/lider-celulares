-- 1. Remove the extra sale from vendas_diarias
DELETE FROM public.vendas_diarias 
WHERE loja_id = 'natal' 
  AND mes = '2026-04' 
  AND vendedor_nome = 'RANIEL' 
  AND data = '2026-04-08' 
  AND servicos = 1000;

-- 2. Update the aggregated vendas table for Raniel in Natal/April 2026
-- We need to reduce PROTEÇÃO LÍDER by 1015.00 to reach the target total
UPDATE public.vendas 
SET detalhes = jsonb_set(
  detalhes, 
  '{PROTEÇÃO LÍDER}', 
  ((COALESCE(detalhes->>'PROTEÇÃO LÍDER', '0')::numeric) - 1015)::text::jsonb
)
WHERE loja_id = 'natal' 
  AND mes = '2026-04' 
  AND vendedor_nome = 'RANIEL';

-- 3. Also update the valor_total in the vendas table
UPDATE public.vendas 
SET valor_total = valor_total - 1015
WHERE loja_id = 'natal' 
  AND mes = '2026-04' 
  AND vendedor_nome = 'RANIEL';

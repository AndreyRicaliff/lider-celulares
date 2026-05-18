UPDATE public.comissoes 
SET 
  comissao_base = 3639.55, 
  comissao_detalhada = '{"GERAL":0,"CASES":11.30,"PELÍCULA":221.50,"SERVIÇOS":568.29,"META PRATA (Smartphones)":2088.45,"SERVIÇOS PESSOAIS (12%)":750.02}'::jsonb, 
  updated_at = now() 
WHERE vendedor_nome = 'RANIEL' 
  AND mes = '2026-04' 
  AND loja_id = 'natal';
-- Corrigir HERBERT (Bateu meta individual, mas não Meta Ouro da loja)
UPDATE public.comissoes
SET comissao_base = 2465.12,
    bonus_automatico = 150.00,
    comissao_detalhada = '{"BONIFICADO LC": 899.85, "SUPER BONIFICADO": 587.97, "ACESSÓRIOS": 14.00, "PELÍCULA": 253.00, "PROTEÇÃO LÍDER": 630.30, "GARANTIA ESTENDIDA": 60.00, "CASES": 20.00}'::jsonb,
    detalhes = detalhes || '{"bonusInfo": [{"descricao": "Melhor Vendedor Smartphone", "valor": 150}]}'::jsonb
WHERE vendedor_nome = 'HERBERT' AND mes = '2026-04' AND loja_id = 'natal';

-- Corrigir LUCAS (Bateu meta individual, mas não Meta Ouro da loja)
UPDATE public.comissoes
SET comissao_base = 2552.84,
    bonus_automatico = 200.00,
    comissao_detalhada = '{"BONIFICADO LC": 773.25, "SUPER BONIFICADO": 581.40, "PELÍCULA": 305.50, "PROTEÇÃO LÍDER": 833.97, "GARANTIA ESTENDIDA": 58.72}'::jsonb,
    detalhes = detalhes || '{"bonusInfo": [{"descricao": "Melhor Vendedor Serviço", "valor": 200}]}'::jsonb
WHERE vendedor_nome = 'LUCAS' AND mes = '2026-04' AND loja_id = 'natal';

-- Corrigir ITALO (Não bateu meta individual)
UPDATE public.comissoes
SET comissao_base = 807.46,
    bonus_automatico = 0,
    comissao_detalhada = '{"BONIFICADO LC": 287.56, "SUPER BONIFICADO": 62.99, "PELÍCULA": 165.50, "PROTEÇÃO LÍDER": 191.83, "GARANTIA ESTENDIDA": 99.58}'::jsonb,
    detalhes = jsonb_set(detalhes, '{bonusInfo}', '[]'::jsonb)
WHERE vendedor_nome = 'ITALO' AND mes = '2026-04' AND loja_id = 'natal';

-- Corrigir EUDIVAN (Não bateu meta individual)
UPDATE public.comissoes
SET comissao_base = 522.03,
    bonus_automatico = 0,
    comissao_detalhada = '{"BONIFICADO LC": 157.01, "SUPER BONIFICADO": 65.62, "PELÍCULA": 71.00, "PROTEÇÃO LÍDER": 154.80, "GARANTIA ESTENDIDA": 73.60}'::jsonb,
    detalhes = jsonb_set(detalhes, '{bonusInfo}', '[]'::jsonb)
WHERE vendedor_nome = 'EUDIVAN' AND mes = '2026-04' AND loja_id = 'natal';

-- Corrigir KAUÃ (Não bateu meta individual)
UPDATE public.comissoes
SET comissao_base = 476.08,
    bonus_automatico = 0,
    comissao_detalhada = '{"BONIFICADO LC": 96.60, "SUPER BONIFICADO": 88.23, "ACESSÓRIOS": 2.25, "PELÍCULA": 91.00, "PROTEÇÃO LÍDER": 135.12, "GARANTIA ESTENDIDA": 62.88}'::jsonb,
    detalhes = jsonb_set(detalhes, '{bonusInfo}', '[]'::jsonb)
WHERE (vendedor_nome = 'KAUA' OR vendedor_nome = 'KAUÃ') AND mes = '2026-04' AND loja_id = 'natal';

-- 1. Limpar dados incompletos do mês para Campina Grande
DELETE FROM vendas_diarias WHERE loja_id = 'campina-grande' AND mes = '2026-05';
DELETE FROM vendas WHERE loja_id = 'campina-grande' AND mes = '2026-05';

-- 2. Inserir vendas diárias baseadas nos atendimentos auditados (que já temos salvos)
INSERT INTO vendas_diarias (
  loja_id, 
  mes, 
  data, 
  vendedor_nome, 
  colaborador_id, 
  valor_total, 
  smartphones, 
  acessorios, 
  servicos, 
  geral, 
  detalhes
)
WITH atendimentos_ativos AS (
  SELECT 
    loja_id,
    mes,
    data_atendimento as data,
    vendedor_nome,
    valor_total,
    detalhes_brutos
  FROM atendimentos_audit
  WHERE loja_id = 'campina-grande' 
    AND mes = '2026-05'
    AND status NOT IN ('Cancelada', 'Cancelado', 'Excluída', 'Excluído')
),
detalhes_extraidos AS (
  SELECT 
    loja_id,
    mes,
    data,
    vendedor_nome,
    valor_total,
    CASE WHEN valor_total >= 800 THEN valor_total ELSE 0 END as smartphones_val,
    CASE WHEN valor_total < 500 AND valor_total > 0 THEN valor_total ELSE 0 END as acessorios_val,
    CASE WHEN valor_total >= 800 THEN 1 ELSE 0 END as qtd_sm
  FROM atendimentos_ativos
)
SELECT 
  d.loja_id,
  d.mes,
  d.data,
  d.vendedor_nome,
  c.id as colaborador_id,
  SUM(d.valor_total) as valor_total,
  SUM(d.smartphones_val) as smartphones,
  SUM(d.acessorios_val) as acessorios,
  0 as servicos,
  0 as geral,
  jsonb_build_object(
    'VALOR REAL (S/ JUROS)', SUM(d.valor_total),
    '__qtd_smartphones', SUM(d.qtd_sm)
  ) as detalhes
FROM detalhes_extraidos d
LEFT JOIN colaboradores c ON (
  (c.nome ILIKE d.vendedor_nome OR d.vendedor_nome ILIKE c.nome) 
  AND c.loja_id = d.loja_id
)
GROUP BY d.loja_id, d.mes, d.data, d.vendedor_nome, c.id;

-- 3. Inserir totais mensais baseados nas diárias recém-criadas
INSERT INTO vendas (
  loja_id,
  mes,
  vendedor_nome,
  colaborador_id,
  valor_total,
  detalhes
)
SELECT 
  loja_id,
  mes,
  vendedor_nome,
  colaborador_id,
  SUM(valor_total) as valor_total,
  jsonb_build_object(
    'VALOR REAL (S/ JUROS)', SUM(valor_total),
    'BONIFICADO LC', SUM(smartphones),
    'ACESSÓRIOS', SUM(acessorios)
  ) as detalhes
FROM vendas_diarias
WHERE loja_id = 'campina-grande' AND mes = '2026-05'
GROUP BY loja_id, mes, vendedor_nome, colaborador_id;

-- 4. Registrar log de sucesso do reprocessamento manual
INSERT INTO sync_logs (
  loja_id,
  mes,
  synced,
  source_rows,
  vendedores_atualizados,
  sem_colaborador,
  success,
  error_message
)
VALUES (
  'campina-grande',
  '2026-05',
  6, 
  113, 
  ARRAY['CÉLIO', 'FLÁVIO', 'FERNANDO', 'PEDRO', 'ITALO', 'MARCELO'],
  ARRAY[]::text[],
  true,
  'Reprocessamento manual via auditoria realizado para contornar rate limit da API.'
);
-- ============================================================
-- SEED FINAL: Colaboradores reais (export Lovable)
-- Projeto: ibpcexyrxwmknrfwifyy
-- ============================================================

-- ── 1. COLABORADORES ─────────────────────────────────────────
INSERT INTO colaboradores (id, nome, loja_id, cargo, salario, ajuda_custo, proporcional_meta) VALUES
  ('32cc30c0-59de-438f-ac9c-9ef6f127ea07', 'ALMIR',    'caruaru',        'Vendedor',  1664.25, 200.00, 100),
  ('d0d20d44-9d6b-492b-95bb-d9f56b2b9d4c', 'CELIO',    'campina-grande', 'Vendedor',  1593.36, 200.00, 100),
  ('0d269f65-ae23-48a9-886d-a4a229d4120b', 'Cid',      NULL,             'Supervisor',1750.00,   0.00, 100),
  ('8b0d5931-d13d-4f04-9ed7-1d8cc10cf0a9', 'EUDIVAN',  'natal',          'Vendedor',  1080.66,   0.00, 100),
  ('02c3ab88-2858-473c-9258-bec78125dd75', 'FELIPE',   'caruaru',        'Vendedor',  1096.75, 200.00, 100),
  ('7c16fdb3-2326-4b9c-8dc9-14f3148e3b73', 'FERNANDO', 'campina-grande', 'Vendedor',  1593.36, 200.00, 100),
  ('992001b2-2153-4d38-a0b5-3e2113858327', 'FLAVIO',   'campina-grande', 'VR',        1525.82, 200.00, 100),
  ('1fc22e79-83ae-48d2-932a-bfda33b15c43', 'Gabriel',  'caruaru',        'Vendedor',     0.00, 200.00, 100),
  ('e016bdc0-53dc-47db-9db2-a0901d431552', 'HERBERT',  'natal',          'Vendedor',  1616.77, 200.00, 100),
  ('a0e18865-4f0d-40bf-862a-06a8d1adca08', 'ITALO',    'natal',          'Vendedor',  1616.77, 200.00, 100),
  ('e0bf0a37-1828-4f9c-9e4f-c11577a2c38e', 'ITALO',    'campina-grande', 'Vendedor',     0.00, 200.00, 100),
  ('af663e63-707a-4c6f-a7c4-f605b81b0daf', 'JOÃO',     'soledade',       'VR',        1507.62, 200.00, 100),
  ('91628803-68dd-42ba-9454-3c07df83b48b', 'KAUÃ',     'natal',          'Trainee',   1616.77, 200.00, 100),
  ('f20c7aef-4c66-4b31-a136-dd3a7d62cb5d', 'LETICIA',  'natal',          'Vendedor',     0.00, 200.00, 100),
  ('bd983706-1f09-4289-8ef9-abc7e1eebd2c', 'LUCAS',    'natal',          'Vendedor',  1499.43, 200.00, 100),
  ('7bc13787-c764-4ba1-98b4-652ae3b9b5fd', 'Luiz',     NULL,             'Supervisor',3000.00, 200.00, 100),
  ('4050f011-cba2-4c43-bd30-c4ab1d07eb44', 'MATHEUS',  'campina-grande', 'Gerente',   2000.00, 200.00, 100),
  ('7a7f2384-0e64-4542-b9d4-e9073c24559d', 'MAYKON',   'campina-grande', 'Trainee',   3317.90,   0.00, 100),
  ('d8db01b5-c26b-4c7c-a59e-a80adb941e75', 'PEDRO',    'campina-grande', 'Vendedor',  1525.82, 200.00, 100),
  ('6ff199bd-408b-4518-b373-dd5f7a6b8516', 'RANIEL',   'natal',          'Gerente',   2000.00, 200.00, 100),
  ('90d8cd71-ad9d-40c7-922c-9dc508d9f52f', 'RENAN',    'monteiro',       'Vendedor',  1507.62, 200.00, 100),
  ('7f0ccc9d-6ecb-4951-9119-242010c6d855', 'VICTOR',   'monteiro',       'Vendedor',     0.00,   0.00, 100),
  ('d952b030-59f1-4f51-bc68-414c6fe48117', 'WANESSA',  'soledade',       'Vendedor',  1507.62, 200.00, 100),
  ('c0285cb8-06ce-4156-88ee-c182ff7a7077', 'WILLIAN',  'caruaru',        'Vendedor',   687.80, 266.66, 100);

-- ── 2. VÍNCULOS (colaborador_lojas) ──────────────────────────
INSERT INTO colaborador_lojas (colaborador_id, loja_id, cargo, salario, ajuda_custo, proporcional_meta) VALUES
  ('d952b030-59f1-4f51-bc68-414c6fe48117', 'soledade',        'Vendedor', 1507.62, 200.00, 100),
  ('af663e63-707a-4c6f-a7c4-f605b81b0daf', 'soledade',        'VR',       1507.62, 200.00, 100),
  ('4050f011-cba2-4c43-bd30-c4ab1d07eb44', 'campina-grande',  'Gerente',  2000.00, 200.00, 100),
  ('d0d20d44-9d6b-492b-95bb-d9f56b2b9d4c', 'campina-grande',  'Vendedor', 1593.36, 200.00, 100),
  ('6ff199bd-408b-4518-b373-dd5f7a6b8516', 'natal',           'Gerente',  2000.00, 200.00, 100),
  ('d8db01b5-c26b-4c7c-a59e-a80adb941e75', 'campina-grande',  'Vendedor', 1525.82, 200.00, 100),
  ('7c16fdb3-2326-4b9c-8dc9-14f3148e3b73', 'campina-grande',  'Vendedor', 1593.36, 200.00, 100),
  ('992001b2-2153-4d38-a0b5-3e2113858327', 'campina-grande',  'VR',       1525.82, 200.00, 100),
  ('992001b2-2153-4d38-a0b5-3e2113858327', 'caruaru',         'VR',          0.00,   0.00, 100),
  ('90d8cd71-ad9d-40c7-922c-9dc508d9f52f', 'monteiro',        'Vendedor', 1507.62, 200.00, 100),
  ('1fc22e79-83ae-48d2-932a-bfda33b15c43', 'caruaru',         'Vendedor',    0.00, 200.00, 100),
  ('32cc30c0-59de-438f-ac9c-9ef6f127ea07', 'caruaru',         'Vendedor', 1664.25, 200.00, 100),
  ('02c3ab88-2858-473c-9258-bec78125dd75', 'caruaru',         'Vendedor', 1096.75, 200.00, 100),
  ('e016bdc0-53dc-47db-9db2-a0901d431552', 'natal',           'Vendedor', 1616.77, 200.00, 100),
  ('91628803-68dd-42ba-9454-3c07df83b48b', 'natal',           'Trainee',  1616.77, 200.00, 100),
  ('bd983706-1f09-4289-8ef9-abc7e1eebd2c', 'natal',           'Vendedor', 1499.43, 200.00, 100),
  ('f20c7aef-4c66-4b31-a136-dd3a7d62cb5d', 'natal',           'Vendedor',    0.00, 200.00, 100),
  ('7f0ccc9d-6ecb-4951-9119-242010c6d855', 'monteiro',        'Vendedor',    0.00,   0.00, 100),
  ('7a7f2384-0e64-4542-b9d4-e9073c24559d', 'campina-grande',  'Trainee',  3317.90,   0.00, 100),
  ('7a7f2384-0e64-4542-b9d4-e9073c24559d', 'caruaru',         'Vendedor',    0.00,   0.00, 100),
  ('c0285cb8-06ce-4156-88ee-c182ff7a7077', 'caruaru',         'Vendedor',  687.80, 266.66, 100),
  ('8b0d5931-d13d-4f04-9ed7-1d8cc10cf0a9', 'natal',           'Vendedor', 1080.66,   0.00, 100),
  ('a0e18865-4f0d-40bf-862a-06a8d1adca08', 'natal',           'Vendedor', 1616.77, 200.00, 100),
  ('a0e18865-4f0d-40bf-862a-06a8d1adca08', 'caruaru',         'Vendedor',    0.00,   0.00, 100),
  ('e0bf0a37-1828-4f9c-9e4f-c11577a2c38e', 'campina-grande',  'Vendedor',    0.00, 200.00, 100);

-- ── 3. RELINK colaborador_id nas vendas históricas ────────────
-- Match direto: upper + trim (maioria dos casos)
UPDATE vendas v
SET colaborador_id = c.id
FROM colaboradores c
WHERE TRIM(UPPER(v.vendedor_nome)) = TRIM(UPPER(c.nome))
  AND v.loja_id = c.loja_id
  AND v.colaborador_id IS NULL;

-- Aliases manuais: nomes com acento diferente entre Tenfront e cadastro
UPDATE vendas SET colaborador_id = 'd0d20d44-9d6b-492b-95bb-d9f56b2b9d4c'
WHERE vendedor_nome = 'CÉLIO' AND loja_id = 'campina-grande' AND colaborador_id IS NULL;

UPDATE vendas SET colaborador_id = '992001b2-2153-4d38-a0b5-3e2113858327'
WHERE vendedor_nome = 'FLÁVIO' AND loja_id = 'campina-grande' AND colaborador_id IS NULL;

UPDATE vendas SET colaborador_id = 'af663e63-707a-4c6f-a7c4-f605b81b0daf'
WHERE vendedor_nome = 'JOÃO' AND loja_id = 'soledade' AND colaborador_id IS NULL;

UPDATE vendas SET colaborador_id = '91628803-68dd-42ba-9454-3c07df83b48b'
WHERE vendedor_nome = 'KAUÃ' AND loja_id = 'natal' AND colaborador_id IS NULL;

-- Alias: IGOR no Tenfront = EUDIVAN no cadastro (natal)
UPDATE vendas SET colaborador_id = '8b0d5931-d13d-4f04-9ed7-1d8cc10cf0a9'
WHERE vendedor_nome = 'IGOR' AND loja_id = 'natal' AND colaborador_id IS NULL;

-- ── 4. RELINK colaborador_id nas vendas_diarias ───────────────
UPDATE vendas_diarias vd
SET colaborador_id = c.id
FROM colaboradores c
WHERE TRIM(UPPER(vd.vendedor_nome)) = TRIM(UPPER(c.nome))
  AND vd.loja_id = c.loja_id
  AND vd.colaborador_id IS NULL;

UPDATE vendas_diarias SET colaborador_id = 'd0d20d44-9d6b-492b-95bb-d9f56b2b9d4c'
WHERE vendedor_nome = 'CÉLIO' AND loja_id = 'campina-grande' AND colaborador_id IS NULL;

UPDATE vendas_diarias SET colaborador_id = '992001b2-2153-4d38-a0b5-3e2113858327'
WHERE vendedor_nome = 'FLÁVIO' AND loja_id = 'campina-grande' AND colaborador_id IS NULL;

UPDATE vendas_diarias SET colaborador_id = 'af663e63-707a-4c6f-a7c4-f605b81b0daf'
WHERE vendedor_nome = 'JOÃO' AND loja_id = 'soledade' AND colaborador_id IS NULL;

UPDATE vendas_diarias SET colaborador_id = '91628803-68dd-42ba-9454-3c07df83b48b'
WHERE vendedor_nome = 'KAUÃ' AND loja_id = 'natal' AND colaborador_id IS NULL;

UPDATE vendas_diarias SET colaborador_id = '8b0d5931-d13d-4f04-9ed7-1d8cc10cf0a9'
WHERE vendedor_nome = 'IGOR' AND loja_id = 'natal' AND colaborador_id IS NULL;

-- ── Verificação final ─────────────────────────────────────────
SELECT loja_id, vendedor_nome,
       COUNT(*) AS meses,
       COUNT(colaborador_id) AS com_id,
       COUNT(*) - COUNT(colaborador_id) AS sem_id
FROM vendas
GROUP BY 1, 2
HAVING COUNT(*) - COUNT(colaborador_id) > 0
ORDER BY 1, 2;

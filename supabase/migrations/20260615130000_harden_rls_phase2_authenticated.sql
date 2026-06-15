-- RLS fase 2 (nivel 1): remover acesso anonimo (public -> authenticated)
-- Aplicado via db query --linked (migrations em drift). Edge function usa service_role (bypassa RLS).
-- Refinamento por loja/role fica para o nivel 2 (precisa validacao por perfil logado).

-- botons
DROP POLICY IF EXISTS "Allow public delete access" ON public.botons;
DROP POLICY IF EXISTS "Allow public insert access" ON public.botons;
DROP POLICY IF EXISTS "Allow public read access" ON public.botons;
DROP POLICY IF EXISTS "Allow public update" ON public.botons;
DROP POLICY IF EXISTS "Allow public update access" ON public.botons;
CREATE POLICY "botons_auth_all" ON public.botons FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- colaboradores
DROP POLICY IF EXISTS "Allow public delete access" ON public.colaboradores;
DROP POLICY IF EXISTS "Allow public insert access" ON public.colaboradores;
DROP POLICY IF EXISTS "Allow public read access" ON public.colaboradores;
DROP POLICY IF EXISTS "Allow public update" ON public.colaboradores;
DROP POLICY IF EXISTS "Allow public update access" ON public.colaboradores;
CREATE POLICY "colaboradores_auth_all" ON public.colaboradores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- comissoes
DROP POLICY IF EXISTS "Allow public delete access" ON public.comissoes;
DROP POLICY IF EXISTS "Allow public insert access" ON public.comissoes;
DROP POLICY IF EXISTS "Allow public read access" ON public.comissoes;
DROP POLICY IF EXISTS "Allow public update" ON public.comissoes;
DROP POLICY IF EXISTS "Allow public update access" ON public.comissoes;
CREATE POLICY "comissoes_auth_all" ON public.comissoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- configuracoes
DROP POLICY IF EXISTS "Allow public delete access" ON public.configuracoes;
DROP POLICY IF EXISTS "Allow public insert access" ON public.configuracoes;
DROP POLICY IF EXISTS "Allow public read access" ON public.configuracoes;
DROP POLICY IF EXISTS "Allow public update" ON public.configuracoes;
DROP POLICY IF EXISTS "Allow public update access" ON public.configuracoes;
CREATE POLICY "configuracoes_auth_all" ON public.configuracoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- dividas
DROP POLICY IF EXISTS "Allow public delete access" ON public.dividas;
DROP POLICY IF EXISTS "Allow public insert access" ON public.dividas;
DROP POLICY IF EXISTS "Allow public read access" ON public.dividas;
DROP POLICY IF EXISTS "Allow public update" ON public.dividas;
DROP POLICY IF EXISTS "Allow public update access" ON public.dividas;
CREATE POLICY "dividas_auth_all" ON public.dividas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- sync_logs (escrita real pela edge function via service_role, que bypassa RLS)
DROP POLICY IF EXISTS "Allow public insert access" ON public.sync_logs;
DROP POLICY IF EXISTS "Allow public read access" ON public.sync_logs;
DROP POLICY IF EXISTS "Allow public update" ON public.sync_logs;
DROP POLICY IF EXISTS "Allow public update access" ON public.sync_logs;
DROP POLICY IF EXISTS "Allow service insert" ON public.sync_logs;
CREATE POLICY "sync_logs_auth_all" ON public.sync_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- tabela_precos
DROP POLICY IF EXISTS "Tabela de preços manageable by service role" ON public.tabela_precos;
DROP POLICY IF EXISTS "Tabela de preços viewable by everyone" ON public.tabela_precos;
DROP POLICY IF EXISTS "Allow public read access" ON public.tabela_precos;
CREATE POLICY "tabela_precos_auth_all" ON public.tabela_precos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- vendas
DROP POLICY IF EXISTS "Allow public delete access" ON public.vendas;
DROP POLICY IF EXISTS "Allow public insert access" ON public.vendas;
DROP POLICY IF EXISTS "Allow public read access" ON public.vendas;
DROP POLICY IF EXISTS "Allow public update" ON public.vendas;
DROP POLICY IF EXISTS "Allow public update access" ON public.vendas;
CREATE POLICY "vendas_auth_all" ON public.vendas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- vendas_diarias
DROP POLICY IF EXISTS "Allow public delete access" ON public.vendas_diarias;
DROP POLICY IF EXISTS "Allow public insert access" ON public.vendas_diarias;
DROP POLICY IF EXISTS "Allow public read access" ON public.vendas_diarias;
DROP POLICY IF EXISTS "Allow public update" ON public.vendas_diarias;
DROP POLICY IF EXISTS "Allow public update access" ON public.vendas_diarias;
CREATE POLICY "vendas_diarias_auth_all" ON public.vendas_diarias FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- vendedor_bloqueios
DROP POLICY IF EXISTS "Allow public delete access" ON public.vendedor_bloqueios;
DROP POLICY IF EXISTS "Allow public insert access" ON public.vendedor_bloqueios;
DROP POLICY IF EXISTS "Allow public read access" ON public.vendedor_bloqueios;
DROP POLICY IF EXISTS "Allow public update" ON public.vendedor_bloqueios;
DROP POLICY IF EXISTS "Allow public update access" ON public.vendedor_bloqueios;
CREATE POLICY "vendedor_bloqueios_auth_all" ON public.vendedor_bloqueios FOR ALL TO authenticated USING (true) WITH CHECK (true);

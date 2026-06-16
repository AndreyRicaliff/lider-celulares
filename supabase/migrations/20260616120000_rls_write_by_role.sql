-- RLS: escrita por papel (substitui escrita 'authenticated' por papel correto).
-- SELECT ja foi definido em migrations anteriores. Aqui ajustamos so a escrita.
-- Edge functions usam service_role (bypassa RLS) — nao afetadas.
-- Aplicado via db query --linked (migrations em drift; db push proibido).

-- ===== comissoes: escrita admin (edicao manual na Folha + batch recalc rodam como admin) =====
DROP POLICY IF EXISTS "comissoes_write_auth" ON public.comissoes;
DROP POLICY IF EXISTS "comissoes_update_auth" ON public.comissoes;
DROP POLICY IF EXISTS "comissoes_delete_auth" ON public.comissoes;
CREATE POLICY "comissoes_insert_admin" ON public.comissoes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "comissoes_update_admin" ON public.comissoes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "comissoes_delete_admin" ON public.comissoes FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ===== colaboradores: escrita admin =====
DROP POLICY IF EXISTS "colaboradores_write_auth" ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores_update_auth" ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores_delete_auth" ON public.colaboradores;
CREATE POLICY "colaboradores_insert_admin" ON public.colaboradores FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "colaboradores_update_admin" ON public.colaboradores FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "colaboradores_delete_admin" ON public.colaboradores FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ===== configuracoes: SELECT autenticado + escrita admin =====
DROP POLICY IF EXISTS "configuracoes_auth_all" ON public.configuracoes;
CREATE POLICY "configuracoes_select_auth" ON public.configuracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "configuracoes_insert_admin" ON public.configuracoes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "configuracoes_update_admin" ON public.configuracoes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "configuracoes_delete_admin" ON public.configuracoes FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ===== vendedor_bloqueios: SELECT autenticado + escrita admin =====
DROP POLICY IF EXISTS "vendedor_bloqueios_auth_all" ON public.vendedor_bloqueios;
CREATE POLICY "vendedor_bloqueios_select_auth" ON public.vendedor_bloqueios FOR SELECT TO authenticated USING (true);
CREATE POLICY "vendedor_bloqueios_insert_admin" ON public.vendedor_bloqueios FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "vendedor_bloqueios_update_admin" ON public.vendedor_bloqueios FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "vendedor_bloqueios_delete_admin" ON public.vendedor_bloqueios FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ===== botons: SELECT autenticado + escrita admin (batch recalc roda como admin) =====
DROP POLICY IF EXISTS "botons_auth_all" ON public.botons;
CREATE POLICY "botons_select_auth" ON public.botons FOR SELECT TO authenticated USING (true);
CREATE POLICY "botons_insert_admin" ON public.botons FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "botons_update_admin" ON public.botons FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "botons_delete_admin" ON public.botons FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ===== dividas: SELECT autenticado + INSERT/DELETE admin + UPDATE admin|supervisao =====
DROP POLICY IF EXISTS "dividas_auth_all" ON public.dividas;
CREATE POLICY "dividas_select_auth" ON public.dividas FOR SELECT TO authenticated USING (true);
CREATE POLICY "dividas_insert_admin" ON public.dividas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "dividas_delete_admin" ON public.dividas FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "dividas_update_admin_sup" ON public.dividas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisao'));

-- ===== tabela_precos: SELECT autenticado; escrita so service_role (sem policy) =====
DROP POLICY IF EXISTS "tabela_precos_auth_all" ON public.tabela_precos;
CREATE POLICY "tabela_precos_select_auth" ON public.tabela_precos FOR SELECT TO authenticated USING (true);

-- ===== vendas / vendas_diarias: remover escrita do cliente (so service_role escreve). SELECT scope mantido. =====
DROP POLICY IF EXISTS "vendas_write_auth" ON public.vendas;
DROP POLICY IF EXISTS "vendas_update_auth" ON public.vendas;
DROP POLICY IF EXISTS "vendas_delete_auth" ON public.vendas;
DROP POLICY IF EXISTS "vendas_diarias_write_auth" ON public.vendas_diarias;
DROP POLICY IF EXISTS "vendas_diarias_update_auth" ON public.vendas_diarias;
DROP POLICY IF EXISTS "vendas_diarias_delete_auth" ON public.vendas_diarias;

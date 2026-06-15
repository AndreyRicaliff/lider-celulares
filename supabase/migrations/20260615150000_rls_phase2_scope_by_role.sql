-- RLS fase 2 nivel 2: leitura por escopo (loja/role).
-- admin/supervisao = tudo; gerente = sua(s) loja(s); colaborador = proprios dados.
-- Escrita permanece authenticated (refinamento de escrita por role = futuro).
-- Edge function usa service_role (bypassa RLS).

-- ===== vendas =====
DROP POLICY IF EXISTS "vendas_auth_all" ON public.vendas;
CREATE POLICY "vendas_select_scope" ON public.vendas FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisao')
  OR (public.is_gerente() AND loja_id IN (SELECT public.current_user_lojas()))
  OR (colaborador_id = public.current_colaborador_id())
);
CREATE POLICY "vendas_write_auth" ON public.vendas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "vendas_update_auth" ON public.vendas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "vendas_delete_auth" ON public.vendas FOR DELETE TO authenticated USING (true);

-- ===== vendas_diarias =====
DROP POLICY IF EXISTS "vendas_diarias_auth_all" ON public.vendas_diarias;
CREATE POLICY "vendas_diarias_select_scope" ON public.vendas_diarias FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisao')
  OR (public.is_gerente() AND loja_id IN (SELECT public.current_user_lojas()))
  OR (colaborador_id = public.current_colaborador_id())
);
CREATE POLICY "vendas_diarias_write_auth" ON public.vendas_diarias FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "vendas_diarias_update_auth" ON public.vendas_diarias FOR UPDATE TO authenticated USING (true);
CREATE POLICY "vendas_diarias_delete_auth" ON public.vendas_diarias FOR DELETE TO authenticated USING (true);

-- ===== comissoes =====
DROP POLICY IF EXISTS "comissoes_auth_all" ON public.comissoes;
CREATE POLICY "comissoes_select_scope" ON public.comissoes FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisao')
  OR (public.is_gerente() AND loja_id IN (SELECT public.current_user_lojas()))
  OR (colaborador_id = public.current_colaborador_id())
);
CREATE POLICY "comissoes_write_auth" ON public.comissoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "comissoes_update_auth" ON public.comissoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "comissoes_delete_auth" ON public.comissoes FOR DELETE TO authenticated USING (true);

-- ===== colaboradores (proprio = id; salario protegido de outros colaboradores) =====
DROP POLICY IF EXISTS "colaboradores_auth_all" ON public.colaboradores;
CREATE POLICY "colaboradores_select_scope" ON public.colaboradores FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisao')
  OR (public.is_gerente() AND loja_id IN (SELECT public.current_user_lojas()))
  OR (id = public.current_colaborador_id())
);
CREATE POLICY "colaboradores_write_auth" ON public.colaboradores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "colaboradores_update_auth" ON public.colaboradores FOR UPDATE TO authenticated USING (true);
CREATE POLICY "colaboradores_delete_auth" ON public.colaboradores FOR DELETE TO authenticated USING (true);

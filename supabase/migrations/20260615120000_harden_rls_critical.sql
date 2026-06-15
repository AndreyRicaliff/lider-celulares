-- Harden RLS — critical fixes (2026-06-15)
--
-- Auditoria de segurança encontrou acesso ANÔNIMO (via anon key, que está no bundle
-- público do frontend) de leitura/escrita a tabelas sensíveis, por policies "USING (true)".
-- Gravidade máxima: a tabela `lojas` expunha as credenciais da API Tenfront do cliente,
-- e `colaborador_lojas` (com salário) aceitava INSERT/UPDATE/DELETE anônimo.
--
-- A edge function sync-tenfront lê `lojas` via service_role (bypassa RLS), então travar
-- o acesso via cliente NÃO a afeta. A tela de Configurações (admin) continua funcionando.
--
-- NOTA: as credenciais Tenfront expostas devem ser consideradas COMPROMETIDAS e
-- rotacionadas no painel Tenfront — fechar o RLS impede vazamento futuro, não o passado.

-- ===== lojas: credenciais Tenfront só para admin (via cliente). service_role bypassa. =====
DROP POLICY IF EXISTS "Allow public read access" ON public.lojas;

CREATE POLICY "lojas_admin_all" ON public.lojas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ===== colaborador_lojas: remover acesso anônimo e escrita pública =====
DROP POLICY IF EXISTS "Allow public read access" ON public.colaborador_lojas;
DROP POLICY IF EXISTS "Allow public insert access" ON public.colaborador_lojas;
DROP POLICY IF EXISTS "Allow public update access" ON public.colaborador_lojas;
DROP POLICY IF EXISTS "Allow public delete access" ON public.colaborador_lojas;

-- SELECT liberado a qualquer usuário autenticado (refinamento por loja/role fica para a
-- fase 2 — ver DECISIONS). O crítico aqui é eliminar o acesso anônimo e a escrita pública.
CREATE POLICY "colaborador_lojas_select_authenticated" ON public.colaborador_lojas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "colaborador_lojas_insert_admin" ON public.colaborador_lojas
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "colaborador_lojas_update_admin" ON public.colaborador_lojas
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "colaborador_lojas_delete_admin" ON public.colaborador_lojas
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

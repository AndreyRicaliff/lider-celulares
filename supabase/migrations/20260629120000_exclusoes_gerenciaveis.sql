-- Tabela de exclusões gerenciáveis pelo gestor (admin), unidas às legadas em constants.ts.
-- Tipos: vendedor (não comissiona), venda (valor não conta), supervisor_servico, botons_loja.
CREATE TABLE IF NOT EXISTS public.exclusoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('vendedor','venda','supervisor_servico','botons_loja')),
  loja_id text NOT NULL,
  mes text NOT NULL,
  vendedor_nome text,
  valor numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exclusoes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='exclusoes' AND policyname='exclusoes_select_auth') THEN
    EXECUTE 'CREATE POLICY exclusoes_select_auth ON public.exclusoes FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='exclusoes' AND policyname='exclusoes_all_admin') THEN
    EXECUTE 'CREATE POLICY exclusoes_all_admin ON public.exclusoes FOR ALL USING (has_role(auth.uid(),''admin''::app_role)) WITH CHECK (has_role(auth.uid(),''admin''::app_role))';
  END IF;
END $$;

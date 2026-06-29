-- Config editável dos supervisores (overrides JSONB sobre SUPERVISORES_CONFIG hardcoded).
-- Vazio = usa o hardcoded (default-preserving). Admin edita salário/comissões/bônus/taxa.
CREATE TABLE IF NOT EXISTS public.supervisor_config (
  nome text PRIMARY KEY,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supervisor_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='supervisor_config' AND policyname='supervisor_config_select_auth') THEN
    EXECUTE 'CREATE POLICY supervisor_config_select_auth ON public.supervisor_config FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='supervisor_config' AND policyname='supervisor_config_all_admin') THEN
    EXECUTE 'CREATE POLICY supervisor_config_all_admin ON public.supervisor_config FOR ALL USING (has_role(auth.uid(),''admin''::app_role)) WITH CHECK (has_role(auth.uid(),''admin''::app_role))';
  END IF;
END $$;

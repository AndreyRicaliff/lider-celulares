CREATE TABLE public.sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id TEXT NOT NULL,
  mes TEXT NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0,
  source_rows INTEGER NOT NULL DEFAULT 0,
  vendedores_atualizados TEXT[] NOT NULL DEFAULT '{}',
  sem_colaborador TEXT[] NOT NULL DEFAULT '{}',
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  lido BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.sync_logs FOR SELECT TO public USING (true);
CREATE POLICY "Allow service insert" ON public.sync_logs FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.sync_logs FOR UPDATE TO public USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_logs;

CREATE TABLE public.vendedor_bloqueios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_nome TEXT NOT NULL,
  loja_id_bloqueada TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(vendedor_nome, loja_id_bloqueada)
);

ALTER TABLE public.vendedor_bloqueios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.vendedor_bloqueios FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.vendedor_bloqueios FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.vendedor_bloqueios FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.vendedor_bloqueios FOR DELETE USING (true);

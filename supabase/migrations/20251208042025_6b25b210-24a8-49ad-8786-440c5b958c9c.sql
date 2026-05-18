-- Create botons table to track monthly awards
CREATE TABLE public.botons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  loja_id text NOT NULL,
  mes text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('triplice_coroa', 'protecao_lider')),
  pontos integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(colaborador_id, mes)
);

-- Enable RLS
ALTER TABLE public.botons ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access" ON public.botons FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.botons FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.botons FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.botons FOR DELETE USING (true);
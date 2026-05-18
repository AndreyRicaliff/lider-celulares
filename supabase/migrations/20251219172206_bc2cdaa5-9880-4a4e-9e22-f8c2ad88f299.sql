-- Tabela para armazenar snapshots diários de vendas
CREATE TABLE public.vendas_diarias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id TEXT NOT NULL,
  mes TEXT NOT NULL,
  data DATE NOT NULL,
  vendedor_nome TEXT NOT NULL,
  colaborador_id UUID REFERENCES public.colaboradores(id),
  valor_total NUMERIC NOT NULL DEFAULT 0,
  smartphones NUMERIC NOT NULL DEFAULT 0,
  acessorios NUMERIC NOT NULL DEFAULT 0,
  servicos NUMERIC NOT NULL DEFAULT 0,
  pos_pago NUMERIC NOT NULL DEFAULT 0,
  controle NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(loja_id, mes, data, vendedor_nome)
);

-- Enable RLS
ALTER TABLE public.vendas_diarias ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow public read access" ON public.vendas_diarias FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.vendas_diarias FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.vendas_diarias FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.vendas_diarias FOR DELETE USING (true);

-- Index para consultas frequentes
CREATE INDEX idx_vendas_diarias_loja_mes ON public.vendas_diarias(loja_id, mes);
CREATE INDEX idx_vendas_diarias_data ON public.vendas_diarias(data);
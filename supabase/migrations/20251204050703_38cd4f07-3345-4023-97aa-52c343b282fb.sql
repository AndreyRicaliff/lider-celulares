-- Enum for positions
CREATE TYPE public.cargo_tipo AS ENUM ('Gerente', 'Vendedor', 'VR', 'Trainee');

-- Table for stores
CREATE TABLE public.lojas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default stores
INSERT INTO public.lojas (id, nome) VALUES 
  ('soledade', 'Soledade'),
  ('monteiro', 'Monteiro'),
  ('campina-grande', 'Campina Grande'),
  ('natal', 'Natal');

-- Table for collaborators
CREATE TABLE public.colaboradores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  loja_id TEXT NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  cargo cargo_tipo NOT NULL DEFAULT 'Vendedor',
  salario NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ajuda_custo NUMERIC(10, 2) NOT NULL DEFAULT 0,
  proporcional_meta INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for debts
CREATE TABLE public.dividas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor_total NUMERIC(10, 2) NOT NULL,
  parcelas_totais INTEGER NOT NULL,
  parcelas_pagas INTEGER NOT NULL DEFAULT 0,
  mes_inicio TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for sales
CREATE TABLE public.vendas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id TEXT NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  vendedor_nome TEXT NOT NULL,
  mes TEXT NOT NULL,
  valor_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  detalhes JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for commissions
CREATE TABLE public.comissoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id TEXT NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  vendedor_nome TEXT NOT NULL,
  cargo TEXT NOT NULL,
  mes TEXT NOT NULL,
  salario NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ajuda_custo NUMERIC(10, 2) NOT NULL DEFAULT 0,
  comissao_base NUMERIC(10, 2) NOT NULL DEFAULT 0,
  comissao_detalhada JSONB NOT NULL DEFAULT '{}',
  repostagem_venda NUMERIC(10, 2) NOT NULL DEFAULT 0,
  repostagem_comissao NUMERIC(10, 2) NOT NULL DEFAULT 0,
  bonus_automatico NUMERIC(10, 2) NOT NULL DEFAULT 0,
  bonus_manual NUMERIC(10, 2) NOT NULL DEFAULT 0,
  descontos_dividas NUMERIC(10, 2) NOT NULL DEFAULT 0,
  adiantamentos NUMERIC(10, 2) NOT NULL DEFAULT 0,
  descontos NUMERIC(10, 2) NOT NULL DEFAULT 0,
  detalhes JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(loja_id, colaborador_id, mes)
);

-- Table for store configurations per month
CREATE TABLE public.configuracoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id TEXT NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  mes TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(loja_id, mes)
);

-- Create indexes for better performance
CREATE INDEX idx_vendas_loja_mes ON public.vendas(loja_id, mes);
CREATE INDEX idx_comissoes_loja_mes ON public.comissoes(loja_id, mes);
CREATE INDEX idx_colaboradores_loja ON public.colaboradores(loja_id);

-- Enable Row Level Security (public access for this internal system)
ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dividas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (internal system)
CREATE POLICY "Allow public read access" ON public.lojas FOR SELECT USING (true);

CREATE POLICY "Allow public read access" ON public.colaboradores FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.colaboradores FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.colaboradores FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.colaboradores FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.dividas FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.dividas FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.dividas FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.dividas FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.vendas FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.vendas FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.vendas FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.vendas FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.comissoes FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.comissoes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.comissoes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.comissoes FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.configuracoes FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.configuracoes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.configuracoes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.configuracoes FOR DELETE USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_colaboradores_updated_at
  BEFORE UPDATE ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_comissoes_updated_at
  BEFORE UPDATE ON public.comissoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_configuracoes_updated_at
  BEFORE UPDATE ON public.configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
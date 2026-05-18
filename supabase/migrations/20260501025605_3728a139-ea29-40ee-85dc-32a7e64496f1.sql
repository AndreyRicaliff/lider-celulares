-- Create the tabela_precos table
CREATE TABLE IF NOT EXISTS public.tabela_precos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modelo TEXT NOT NULL,
    memoria TEXT,
    preco_tabela NUMERIC NOT NULL,
    desconto_livre NUMERIC DEFAULT 0,
    desconto_servico NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tabela_precos ENABLE ROW LEVEL SECURITY;

-- Policies for tabela_precos
CREATE POLICY "Tabela de preços viewable by everyone" ON public.tabela_precos FOR SELECT USING (true);
CREATE POLICY "Tabela de preços manageable by service role" ON public.tabela_precos FOR ALL USING (true) WITH CHECK (true);

-- Create a unique index to help with upserting
CREATE UNIQUE INDEX IF NOT EXISTS idx_tabela_precos_modelo_memoria ON public.tabela_precos (modelo, memoria);

-- We might want to add a column to atendimentos_audit to store how many alerts it has
-- But let's first check if atendimentos_audit exists and what columns it has.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'atendimentos_audit' AND column_name = 'alertas_preco') THEN
        ALTER TABLE public.atendimentos_audit ADD COLUMN alertas_preco INTEGER DEFAULT 0;
    END IF;
END $$;

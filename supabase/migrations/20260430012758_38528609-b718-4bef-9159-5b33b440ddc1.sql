CREATE TABLE IF NOT EXISTS public.atendimentos_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id TEXT NOT NULL,
    atendimento_id TEXT NOT NULL UNIQUE,
    vendedor_nome TEXT NOT NULL,
    data_atendimento DATE NOT NULL,
    valor_total NUMERIC NOT NULL DEFAULT 0,
    detalhes_brutos JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT,
    mes TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexação para performance de busca por período e loja
CREATE INDEX IF NOT EXISTS idx_atendimentos_audit_loja_mes ON public.atendimentos_audit(loja_id, mes);
CREATE INDEX IF NOT EXISTS idx_atendimentos_audit_vendedor ON public.atendimentos_audit(vendedor_nome);

-- RLS
ALTER TABLE public.atendimentos_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e Supervisores podem ver auditoria"
ON public.atendimentos_audit
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'supervisao')
    )
);
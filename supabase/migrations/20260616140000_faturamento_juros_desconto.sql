-- Faturamento decomposto: capturar juros de parcelamento e descontos concedidos.
-- Aplicado via db query --linked (migrations em drift).
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS juros numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto numeric DEFAULT 0;
ALTER TABLE public.vendas_diarias
  ADD COLUMN IF NOT EXISTS juros numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto numeric DEFAULT 0;
ALTER TABLE public.atendimentos_audit
  ADD COLUMN IF NOT EXISTS total_desconto numeric DEFAULT 0;

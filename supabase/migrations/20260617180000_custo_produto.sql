-- Custo por produto (Σ "Custo"×qtd dos itens) para expor lucro/margem batendo o
-- "Resultado por produto" do Tenfront. valor_bruto já existe (= faturamento / "Total bruto").
-- Aplicado via db query --linked (migrations em drift).
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS custo numeric DEFAULT 0;
ALTER TABLE public.vendas_diarias
  ADD COLUMN IF NOT EXISTS custo numeric DEFAULT 0;

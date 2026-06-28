-- Migration: adiciona custo (CMV) ao faturamento_loja
-- Σ "Custo" dos itens vendidos (s/ seminovo) — alimentado pelo sync a partir do audit.
-- Base do lucro bruto da operação de venda: lucro_bruto = liquido - custo.
-- Aditiva e não-destrutiva (default 0); popula no próximo sync por loja.

alter table public.faturamento_loja
  add column if not exists custo numeric not null default 0;

comment on column public.faturamento_loja.custo is 'Σ Custo dos itens (CMV, s/ seminovo) — lucro bruto = liquido - custo';

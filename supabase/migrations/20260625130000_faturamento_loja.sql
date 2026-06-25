-- Faturamento "espelho Tenfront" por loja/mês — isolado da comissão.
-- Alimentado pelo sync a partir do atendimentos_audit. NÃO afeta vendas/comissões.
-- Espelho calculado no app: total_bruto + (config.bruto_inclui_juros ? 0 : juros).

create table if not exists public.faturamento_loja (
  loja_id text not null,
  mes text not null,
  liquido numeric not null default 0,            -- Σ "Valor de venda" (base de comissão)
  juros numeric not null default 0,              -- Σ acréscimo de parcelamento
  faturamento_extra numeric not null default 0,  -- GAR/troca revendida (Total bruto>0, sem item de Venda)
  total_bruto numeric not null default 0,        -- Σ "Total bruto" (>0) — campo cru do Tenfront
  atendimentos integer not null default 0,       -- nº de atendimentos concluídos (Total bruto>=0)
  updated_at timestamptz not null default now(),
  primary key (loja_id, mes)
);

alter table public.faturamento_loja enable row level security;

-- Leitura por escopo (info gerencial): admin/supervisão veem tudo; gerente só a(s) própria(s)
-- loja(s); vendedor comum NÃO vê faturamento de loja. Espelha a policy de `vendas`.
-- Escrita: somente service_role (edge function de sync) — bypassa RLS, sem policy de escrita.
drop policy if exists "faturamento_loja_select_scope" on public.faturamento_loja;
create policy "faturamento_loja_select_scope" on public.faturamento_loja
  for select to authenticated
  using (
    has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'supervisao'::app_role)
    or (is_gerente() and loja_id in (select current_user_lojas()))
  );

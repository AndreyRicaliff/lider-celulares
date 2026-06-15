-- Funcoes helper para RLS por loja/role (fase 2 nivel 2)
-- SECURITY DEFINER + search_path fixo (evita escalonamento via search_path).

-- colaborador_id do usuario logado
CREATE OR REPLACE FUNCTION public.current_colaborador_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT colaborador_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- usuario logado e gerente? (role colaborador com cargo Gerente ou acesso_gerente)
CREATE OR REPLACE FUNCTION public.is_gerente()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.colaboradores c ON c.id = ur.colaborador_id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'colaborador'
      AND (c.cargo = 'Gerente' OR c.acesso_gerente = true)
  );
$$;

-- lojas que o usuario logado acessa (loja principal + vinculos colaborador_lojas)
CREATE OR REPLACE FUNCTION public.current_user_lojas()
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.loja_id FROM public.user_roles ur
    JOIN public.colaboradores c ON c.id = ur.colaborador_id
    WHERE ur.user_id = auth.uid() AND c.loja_id IS NOT NULL
  UNION
  SELECT cl.loja_id FROM public.user_roles ur
    JOIN public.colaborador_lojas cl ON cl.colaborador_id = ur.colaborador_id
    WHERE ur.user_id = auth.uid() AND cl.loja_id IS NOT NULL;
$$;

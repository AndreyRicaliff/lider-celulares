
-- Drop existing foreign keys that reference colaboradores and recreate with ON DELETE SET NULL
ALTER TABLE public.vendas DROP CONSTRAINT IF EXISTS vendas_colaborador_id_fkey;
ALTER TABLE public.vendas ADD CONSTRAINT vendas_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id) ON DELETE SET NULL;

ALTER TABLE public.comissoes DROP CONSTRAINT IF EXISTS comissoes_colaborador_id_fkey;
ALTER TABLE public.comissoes ADD CONSTRAINT comissoes_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id) ON DELETE SET NULL;

ALTER TABLE public.dividas DROP CONSTRAINT IF EXISTS dividas_colaborador_id_fkey;
ALTER TABLE public.dividas ADD CONSTRAINT dividas_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id) ON DELETE CASCADE;

ALTER TABLE public.botons DROP CONSTRAINT IF EXISTS botons_colaborador_id_fkey;
ALTER TABLE public.botons ADD CONSTRAINT botons_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id) ON DELETE CASCADE;

ALTER TABLE public.vendas_diarias DROP CONSTRAINT IF EXISTS vendas_diarias_colaborador_id_fkey;
ALTER TABLE public.vendas_diarias ADD CONSTRAINT vendas_diarias_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id) ON DELETE SET NULL;

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_colaborador_id_fkey;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id) ON DELETE CASCADE;

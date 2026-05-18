-- 1. Criar tabela de vínculo colaborador <-> loja
CREATE TABLE public.colaborador_lojas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  loja_id TEXT NOT NULL REFERENCES public.lojas(id),
  cargo cargo_tipo NOT NULL DEFAULT 'Vendedor',
  salario NUMERIC NOT NULL DEFAULT 0,
  ajuda_custo NUMERIC NOT NULL DEFAULT 0,
  proporcional_meta INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (colaborador_id, loja_id)
);

CREATE INDEX idx_colaborador_lojas_colaborador ON public.colaborador_lojas(colaborador_id);
CREATE INDEX idx_colaborador_lojas_loja ON public.colaborador_lojas(loja_id);

ALTER TABLE public.colaborador_lojas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.colaborador_lojas FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.colaborador_lojas FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.colaborador_lojas FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.colaborador_lojas FOR DELETE USING (true);

CREATE TRIGGER update_colaborador_lojas_updated_at
BEFORE UPDATE ON public.colaborador_lojas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Popular colaborador_lojas com vínculos atuais (apenas colaboradores com loja_id definida)
INSERT INTO public.colaborador_lojas (colaborador_id, loja_id, cargo, salario, ajuda_custo, proporcional_meta)
SELECT id, loja_id, cargo, salario, ajuda_custo, COALESCE(proporcional_meta, 100)
FROM public.colaboradores
WHERE loja_id IS NOT NULL;

-- 3. Unificar duplicados (manter o mais antigo por created_at)
DO $$
DECLARE
  dup RECORD;
  principal_id UUID;
  secundario_id UUID;
  secundario_loja TEXT;
  secundario_cargo cargo_tipo;
  secundario_salario NUMERIC;
  secundario_ajuda NUMERIC;
  secundario_prop INTEGER;
BEGIN
  FOR dup IN
    SELECT UPPER(nome) AS nome_norm
    FROM public.colaboradores
    GROUP BY UPPER(nome)
    HAVING COUNT(*) > 1
  LOOP
    -- Pega o principal (mais antigo)
    SELECT id INTO principal_id
    FROM public.colaboradores
    WHERE UPPER(nome) = dup.nome_norm
    ORDER BY created_at ASC
    LIMIT 1;

    -- Itera sobre os secundários
    FOR secundario_id, secundario_loja, secundario_cargo, secundario_salario, secundario_ajuda, secundario_prop IN
      SELECT id, loja_id, cargo, salario, ajuda_custo, COALESCE(proporcional_meta, 100)
      FROM public.colaboradores
      WHERE UPPER(nome) = dup.nome_norm
        AND id <> principal_id
    LOOP
      -- Move dados relacionados para o principal
      UPDATE public.vendas SET colaborador_id = principal_id WHERE colaborador_id = secundario_id;
      UPDATE public.vendas_diarias SET colaborador_id = principal_id WHERE colaborador_id = secundario_id;
      UPDATE public.comissoes SET colaborador_id = principal_id WHERE colaborador_id = secundario_id;
      UPDATE public.dividas SET colaborador_id = principal_id WHERE colaborador_id = secundario_id;
      UPDATE public.botons SET colaborador_id = principal_id WHERE colaborador_id = secundario_id;
      UPDATE public.user_roles SET colaborador_id = principal_id WHERE colaborador_id = secundario_id;

      -- Cria/atualiza vínculo da loja do secundário no principal
      INSERT INTO public.colaborador_lojas (colaborador_id, loja_id, cargo, salario, ajuda_custo, proporcional_meta)
      VALUES (principal_id, secundario_loja, secundario_cargo, secundario_salario, secundario_ajuda, secundario_prop)
      ON CONFLICT (colaborador_id, loja_id) DO UPDATE
        SET cargo = EXCLUDED.cargo,
            salario = GREATEST(public.colaborador_lojas.salario, EXCLUDED.salario),
            ajuda_custo = GREATEST(public.colaborador_lojas.ajuda_custo, EXCLUDED.ajuda_custo),
            proporcional_meta = EXCLUDED.proporcional_meta;

      -- Remove o registro secundário
      DELETE FROM public.colaboradores WHERE id = secundario_id;
    END LOOP;
  END LOOP;
END $$;
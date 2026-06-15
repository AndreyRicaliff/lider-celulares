import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Colaborador, ColaboradorLoja, Divida, ColaboradorComDividas, CargoTipo } from '@/types/database';
import { toast } from 'sonner';
import { getLojaIdsForQuery } from '@/lib/lojaRules';

export const useColaboradores = (lojaId?: string) => {
  return useQuery({
    queryKey: ['colaboradores', lojaId],
    queryFn: async (): Promise<ColaboradorComDividas[]> => {
      const lojaIds = getLojaIdsForQuery(lojaId);

      // 1. Buscar todos os colaboradores
      const { data: colaboradores, error } = await supabase
        .from('colaboradores')
        .select('*')
        .order('nome');
      if (error) throw error;

      // 2. Buscar todos os vínculos colaborador <-> loja
      const { data: vinculos } = await supabase
        .from('colaborador_lojas')
        .select('*');

      const vinculosByColaborador = new Map<string, ColaboradorLoja[]>();
      (vinculos || []).forEach((v) => {
        const arr = vinculosByColaborador.get(v.colaborador_id) || [];
        arr.push({
          ...v,
          cargo: v.cargo as CargoTipo,
        } as ColaboradorLoja);
        vinculosByColaborador.set(v.colaborador_id, arr);
      });

      // 3. Filtrar por loja (via vínculos) ou supervisores (sem loja)
      let filtered = (colaboradores || []).map(col => {
        const vins = vinculosByColaborador.get(col.id) || [];
        
        // Se estivermos filtrando por loja, atualizar os dados do colaborador com os dados do vínculo
        if (lojaIds.length > 0) {
          const vinculoLoja = vins.find(v => lojaIds.includes(v.loja_id));
          if (vinculoLoja) {
            return {
              ...col,
              cargo: vinculoLoja.cargo,
              salario: vinculoLoja.salario,
              ajuda_custo: vinculoLoja.ajuda_custo,
              proporcional_meta: vinculoLoja.proporcional_meta,
              lojas: vins
            };
          }
          // Se não tem vínculo com a loja mas é supervisor (loja_id null), mantém
          if (col.loja_id === null) return { ...col, lojas: vins };
          return null;
        }
        
        return { ...col, lojas: vins };
      }).filter(Boolean) as (Colaborador & { lojas: ColaboradorLoja[] })[];

      // 4. Buscar dívidas em paralelo
      const colaboradoresComDividas: ColaboradorComDividas[] = await Promise.all(
        filtered.map(async (col) => {
          let query = supabase
            .from('dividas')
            .select('*')
            .eq('colaborador_id', col.id);
          
          if (lojaId) {
            query = query.or(`loja_id.is.null,loja_id.eq.${lojaId}`);
          }

          const { data: dividas } = await query;


          return {
            ...col,
            cargo: col.cargo as CargoTipo,
            dividas: (dividas || []).map((d) => ({
              ...d,
              loja_id: (d as unknown as { loja_id: string | null }).loja_id ?? null,
            })) as Divida[],
          };
        })
      );

      return colaboradoresComDividas;
    },
  });
};

// Hook específico para supervisores
export const useSupervisores = () => {
  return useQuery({
    queryKey: ['supervisores'],
    queryFn: async (): Promise<ColaboradorComDividas[]> => {
      const { data: colaboradores, error } = await supabase
        .from('colaboradores')
        .select('*')
        .eq('cargo', 'Supervisor')
        .order('nome');
      
      if (error) throw error;
      
      const colaboradoresComDividas: ColaboradorComDividas[] = await Promise.all(
        (colaboradores || []).map(async (col) => {
          const { data: dividas } = await supabase
            .from('dividas')
            .select('*')
            .eq('colaborador_id', col.id);
          
          return {
            ...col,
            cargo: col.cargo as CargoTipo,
            dividas: (dividas || []).map(d => ({
              ...d,
              loja_id: (d as unknown as { loja_id: string | null }).loja_id ?? null,
            })) as Divida[],
          };
        })
      );
      
      return colaboradoresComDividas;
    },
  });
};

export const useDeleteColaborador = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('colaboradores')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaboradores'] });
      toast.success('Colaborador excluído com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir colaborador: ' + error.message);
    },
  });
};

// Dividas mutations
export const useCreateDivida = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Omit<Divida, 'id' | 'created_at'>) => {
      const { data: result, error } = await supabase
        .from('dividas')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaboradores'] });
      queryClient.invalidateQueries({ queryKey: ['colaborador'] });
      toast.success('Dívida adicionada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao adicionar dívida: ' + error.message);
    },
  });
};

export const useDeleteDivida = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('dividas')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaboradores'] });
      queryClient.invalidateQueries({ queryKey: ['colaborador'] });
      queryClient.invalidateQueries({ queryKey: ['dividas'] });
      toast.success('Dívida excluída com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir dívida: ' + error.message);
    },
  });
};

// Hook para atualizar as parcelas pagas das dívidas após o cálculo de comissões
export const useAtualizarParcelasDividas = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ dividasParaAtualizar }: { 
      dividasParaAtualizar: Array<{ id: string; parcelaAtual: number }> 
    }) => {
      // Atualizar cada dívida com o número de parcelas pagas
      const updates = dividasParaAtualizar.map(async (divida) => {
        const { error } = await supabase
          .from('dividas')
          .update({ parcelas_pagas: divida.parcelaAtual })
          .eq('id', divida.id);
        
        if (error) throw error;
      });
      
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaboradores'] });
      queryClient.invalidateQueries({ queryKey: ['colaborador'] });
      queryClient.invalidateQueries({ queryKey: ['dividas'] });
      queryClient.invalidateQueries({ queryKey: ['supervisores'] });
    },
    onError: (error: any) => {
      console.error('Erro ao atualizar parcelas de dívidas:', error);
      toast.error('Erro ao atualizar parcelas de dívidas: ' + (error?.message || 'tente novamente'));
    },
  });
};

// Hook para buscar dívidas de um colaborador específico
export const useDividas = (colaboradorId?: string) => {
  return useQuery({
    queryKey: ['dividas', colaboradorId],
    queryFn: async (): Promise<Divida[]> => {
      if (!colaboradorId) return [];

      const { data, error } = await supabase
        .from('dividas')
        .select('*')
        .eq('colaborador_id', colaboradorId);

      if (error) throw error;

      return (data || []).map(d => ({
        ...d,
        loja_id: (d as unknown as { loja_id: string | null }).loja_id ?? null,
      })) as Divida[];
    },
    enabled: !!colaboradorId,
  });
};

// ===== Vínculos colaborador <-> loja =====

export interface VinculoLojaInput {
  loja_id: string;
  cargo: CargoTipo;
  salario: number;
  ajuda_custo: number;
  proporcional_meta: number;
}

/**
 * Cria um colaborador novo com múltiplos vínculos de loja.
 * Os campos legados (loja_id, cargo, salario, ajuda_custo, proporcional_meta) na
 * tabela colaboradores são populados a partir do PRIMEIRO vínculo, para manter
 * compatibilidade com cálculos que ainda leem esses campos diretamente.
 */
export const useCreateColaboradorComLojas = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      nome,
      vinculos,
    }: {
      nome: string;
      vinculos: VinculoLojaInput[];
    }) => {
      if (vinculos.length === 0) throw new Error('Selecione ao menos uma loja');

      const principal = vinculos[0];

      const { data: colaborador, error } = await supabase
        .from('colaboradores')
        .insert({
          nome,
          loja_id: principal.loja_id,
          cargo: principal.cargo,
          salario: principal.salario,
          ajuda_custo: principal.ajuda_custo,
          proporcional_meta: principal.proporcional_meta,
        })
        .select()
        .single();

      if (error) throw error;

      const vinculosToInsert = vinculos.map((v) => ({
        colaborador_id: colaborador.id,
        loja_id: v.loja_id,
        cargo: v.cargo,
        salario: v.salario,
        ajuda_custo: v.ajuda_custo,
        proporcional_meta: v.proporcional_meta,
      }));

      const { error: vinculoError } = await supabase
        .from('colaborador_lojas')
        .insert(vinculosToInsert);

      if (vinculoError) throw vinculoError;

      return colaborador;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaboradores'] });
      toast.success('Colaborador criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar colaborador: ' + error.message);
    },
  });
};

/**
 * Atualiza nome + sincroniza os vínculos de loja (substitui completamente).
 * Mantém os campos legados em colaboradores apontando para o primeiro vínculo.
 */
export const useUpdateColaboradorComLojas = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      nome,
      vinculos,
    }: {
      id: string;
      nome: string;
      vinculos: VinculoLojaInput[];
    }) => {
      if (vinculos.length === 0) throw new Error('Selecione ao menos uma loja');

      const principal = vinculos[0];

      const { error: updError } = await supabase
        .from('colaboradores')
        .update({
          nome,
          loja_id: principal.loja_id,
          cargo: principal.cargo,
          salario: principal.salario,
          ajuda_custo: principal.ajuda_custo,
          proporcional_meta: principal.proporcional_meta,
        })
        .eq('id', id);

      if (updError) throw updError;

      const { error: delError } = await supabase
        .from('colaborador_lojas')
        .delete()
        .eq('colaborador_id', id);

      if (delError) throw delError;

      const vinculosToInsert = vinculos.map((v) => ({
        colaborador_id: id,
        loja_id: v.loja_id,
        cargo: v.cargo,
        salario: v.salario,
        ajuda_custo: v.ajuda_custo,
        proporcional_meta: v.proporcional_meta,
      }));

      const { error: insError } = await supabase
        .from('colaborador_lojas')
        .insert(vinculosToInsert);

      if (insError) throw insError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaboradores'] });
      queryClient.invalidateQueries({ queryKey: ['colaborador'] });
      toast.success('Colaborador atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar colaborador: ' + error.message);
    },
  });
};

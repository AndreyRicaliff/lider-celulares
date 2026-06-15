import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Comissao } from '@/types/database';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';
import { getLojaIdsForQuery } from '@/lib/lojaRules';

export const useComissoes = (lojaId?: string, mes?: string) => {
  return useQuery({
    queryKey: ['comissoes', lojaId, mes],
    staleTime: 1000 * 60 * 5, // 5 minutos
    gcTime: 1000 * 60 * 30, // 30 minutos
    queryFn: async (): Promise<Comissao[]> => {
      let query = supabase.from('comissoes').select('*');
      
      if (lojaId) {
        const lojaIds = getLojaIdsForQuery(lojaId);
        query = lojaIds.length === 1 ? query.eq('loja_id', lojaId) : query.in('loja_id', lojaIds);
      }
      if (mes) {
        query = query.eq('mes', mes);
      }
      
      const { data, error } = await query.order('vendedor_nome');
      if (error) throw error;
      
      return (data || []).map(c => ({
        ...c,
        comissao_detalhada: c.comissao_detalhada as Record<string, number>,
        detalhes: c.detalhes as Comissao['detalhes'],
      }));
    },
  });
};

interface ComissaoInsert {
  loja_id: string;
  colaborador_id: string | null;
  vendedor_nome: string;
  cargo: string;
  mes: string;
  salario: number;
  ajuda_custo: number;
  comissao_base: number;
  comissao_detalhada: Json;
  repostagem_venda: number;
  repostagem_comissao: number;
  bonus_automatico: number;
  bonus_manual: number;
  descontos_dividas: number;
  adiantamentos: number;
  descontos: number;
  detalhes: Json;
}

export const useUpdateComissao = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: { 
      id: string;
      repostagem_venda?: number;
      repostagem_comissao?: number;
      bonus_manual?: number;
      adiantamentos?: number;
      descontos?: number;
    }) => {
      const { data: result, error } = await supabase
        .from('comissoes')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comissoes'] });
      toast.success('Comissão atualizada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar comissão: ' + error.message);
    },
  });
};

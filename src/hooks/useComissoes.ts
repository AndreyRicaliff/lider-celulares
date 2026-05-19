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

export const useComissao = (id: string) => {
  return useQuery({
    queryKey: ['comissao', id],
    queryFn: async (): Promise<Comissao | null> => {
      const { data, error } = await supabase
        .from('comissoes')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      
      return {
        ...data,
        comissao_detalhada: data.comissao_detalhada as Record<string, number>,
        detalhes: data.detalhes as Comissao['detalhes'],
      };
    },
    enabled: !!id,
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

export const useSaveComissoes = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ lojaId, mes, comissoes }: { 
      lojaId: string; 
      mes: string; 
      comissoes: ComissaoInsert[]
    }) => {
      // Fetch existing manual values before deleting
      const { data: existing } = await supabase
        .from('comissoes')
        .select('vendedor_nome, bonus_manual, adiantamentos, descontos')
        .eq('loja_id', lojaId)
        .eq('mes', mes);
      
      const manualValues = new Map<string, { bonus_manual: number; adiantamentos: number; descontos: number }>();
      (existing || []).forEach((c: any) => {
        manualValues.set(c.vendedor_nome, {
          bonus_manual: Number(c.bonus_manual || 0),
          adiantamentos: Number(c.adiantamentos || 0),
          descontos: Number(c.descontos || 0),
        });
      });

      // Merge preserved manual values into new comissoes
      const mergedComissoes = comissoes.map(c => {
        const prev = manualValues.get(c.vendedor_nome);
        if (prev) {
          return {
            ...c,
            bonus_manual: (c.bonus_manual || 0) + prev.bonus_manual,
            adiantamentos: (c.adiantamentos || 0) + prev.adiantamentos,
            descontos: (c.descontos || 0) + prev.descontos,
          };
        }
        return c;
      });

      // Delete existing comissoes for this month and loja
      await supabase
        .from('comissoes')
        .delete()
        .eq('loja_id', lojaId)
        .eq('mes', mes);
      
      // Insert new comissoes with preserved values
      const { data, error } = await supabase
        .from('comissoes')
        .insert(mergedComissoes)
        .select();
      
      if (error) throw error;

      // Coletar todas as dívidas que foram descontadas para atualizar parcelas_pagas
      const dividasParaAtualizar: Array<{ id: string; parcelaAtual: number }> = [];
      
      comissoes.forEach(comissao => {
        const detalhes = comissao.detalhes as { dividasInfo?: Array<{ id: string; parcelaAtual: number }> };
        if (detalhes?.dividasInfo && Array.isArray(detalhes.dividasInfo)) {
          detalhes.dividasInfo.forEach(divida => {
            // Adicionar apenas se ainda não está na lista (evitar duplicatas)
            if (!dividasParaAtualizar.find(d => d.id === divida.id)) {
              dividasParaAtualizar.push({
                id: divida.id,
                parcelaAtual: divida.parcelaAtual
              });
            }
          });
        }
      });

      // Atualizar parcelas_pagas de todas as dívidas descontadas
      if (dividasParaAtualizar.length > 0) {
        // Nunca diminuir parcelas_pagas (recalcular meses antigos não pode “voltar” a dívida).
        const ids = dividasParaAtualizar.map(d => d.id);
        const { data: dividasAtuais, error: readError } = await supabase
          .from('dividas')
          .select('id, parcelas_pagas')
          .in('id', ids);
        
        if (readError) {
          console.error('Erro ao ler dívidas para atualização:', readError);
          toast.error('Erro ao ler dívidas: ' + readError.message);
        }

        const pagasPorId = new Map<string, number>();
        (dividasAtuais || []).forEach((d: any) => {
          pagasPorId.set(d.id, Number(d.parcelas_pagas || 0));
        });

        const updates = dividasParaAtualizar.map(async (divida) => {
          const atual = pagasPorId.get(divida.id) ?? 0;
          const novoValor = Math.max(atual, divida.parcelaAtual);
          const { error: updateError } = await supabase
            .from('dividas')
            .update({ parcelas_pagas: novoValor })
            .eq('id', divida.id);

          if (updateError) {
            console.error('Erro ao atualizar parcela da dívida:', updateError);
            toast.error('Erro ao atualizar parcela de dívida: ' + updateError.message);
          }
        });

        await Promise.all(updates);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comissoes'] });
      queryClient.invalidateQueries({ queryKey: ['colaboradores'] });
      queryClient.invalidateQueries({ queryKey: ['dividas'] });
      toast.success('Comissões calculadas com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao salvar comissões: ' + error.message);
    },
  });
};

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

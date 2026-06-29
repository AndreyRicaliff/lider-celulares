import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Exclusao {
  id: string;
  tipo: 'vendedor' | 'venda' | 'supervisor_servico' | 'botons_loja';
  loja_id: string;
  mes: string;
  vendedor_nome: string | null;
  valor: number | null;
}

export const useExclusoes = (lojaId: string, mes: string) =>
  useQuery({
    queryKey: ['exclusoes', lojaId, mes],
    enabled: !!lojaId && !!mes,
    queryFn: async (): Promise<Exclusao[]> => {
      const { data, error } = await supabase
        .from('exclusoes')
        .select('*')
        .eq('loja_id', lojaId)
        .eq('mes', mes)
        .order('tipo');
      if (error) throw error;
      return (data ?? []) as Exclusao[];
    },
  });

export const useExclusaoMutations = (lojaId: string, mes: string) => {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['exclusoes', lojaId, mes] });

  const adicionar = useMutation({
    mutationFn: async (e: { tipo: Exclusao['tipo']; vendedor_nome?: string; valor?: number }) => {
      const { error } = await supabase.from('exclusoes').insert({
        loja_id: lojaId,
        mes,
        tipo: e.tipo,
        vendedor_nome: e.vendedor_nome?.trim() || null,
        valor: e.valor ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('exclusoes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { adicionar, remover };
};

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { AtendimentoAudit, TabelaPreco } from './types';
import { idsParaQuery } from './grupos';

interface Params {
  selectedLoja: string | null;
  selectedMes: string;
  agruparCaruaru: boolean;
}

export function useAuditoriaData({ selectedLoja, selectedMes, agruparCaruaru }: Params) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('atendimentos-audit-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atendimentos_audit' }, () => {
        queryClient.invalidateQueries({ queryKey: ['atendimentos-audit'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-tenfront', {
        body: { mes: selectedMes, loja_id: selectedLoja || undefined },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Sincronização concluída com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['atendimentos-audit'] });
      queryClient.invalidateQueries({ queryKey: ['daily-sales'] });
      queryClient.invalidateQueries({ queryKey: ['vendas'] });
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : 'Verifique os logs';
      console.error('Erro na sincronização:', error);
      toast.error(`Erro ao sincronizar: ${msg}`);
    },
  });

  const { data: atendimentos = [], isLoading } = useQuery({
    queryKey: ['atendimentos-audit', selectedLoja, selectedMes, agruparCaruaru],
    queryFn: async () => {
      let query = supabase.from('atendimentos_audit').select('*').eq('mes', selectedMes);
      if (selectedLoja) {
        const ids = idsParaQuery(selectedLoja, agruparCaruaru);
        query = ids.length > 1 ? query.in('loja_id', ids) : query.eq('loja_id', ids[0]);
      }
      const { data, error } = await query.order('data_atendimento', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AtendimentoAudit[];
    },
    enabled: !!selectedMes,
  });

  const { data: tabelaPrecos = [] } = useQuery({
    queryKey: ['tabela-precos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tabela_precos').select('*');
      if (error) throw error;
      return (data || []) as unknown as TabelaPreco[];
    },
  });

  return { atendimentos, tabelaPrecos, isLoading, syncMutation };
}

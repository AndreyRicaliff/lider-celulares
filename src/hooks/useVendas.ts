import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Venda } from '@/types/database';
import { isVendedorExcluido, isVendaExcluida } from '@/lib/constants';
import { getLojaIdsForQuery } from '@/lib/lojaRules';

export const useVendas = (lojaId?: string, mes?: string, vendedor?: string) => {
  return useQuery({
    queryKey: ['vendas', lojaId, mes, vendedor],
    queryFn: async (): Promise<Venda[]> => {
      let query = supabase.from('vendas').select('*');

      if (lojaId) {
        const lojaIds = getLojaIdsForQuery(lojaId);
        query = query.in('loja_id', lojaIds);
      }
      if (mes) {
        query = query.eq('mes', mes);
      }
      if (vendedor) {
        query = query.eq('vendedor_nome', vendedor);
      }


      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      // Filtra vendedores excluídos e vendas específicas
      const filteredData = (data || []).filter(v => {
        const lojaIdVenda = lojaId || v.loja_id;
        const mesVenda = mes || v.mes;
        
        const isVendExcluido = isVendedorExcluido(lojaIdVenda, mesVenda, v.vendedor_nome);
        const isVndExcluida = isVendaExcluida(lojaIdVenda, mesVenda, v.vendedor_nome, v.valor_total);
        
        return !isVendExcluido && !isVndExcluida;
      });
      
      return filteredData.map(v => ({
        ...v,
        detalhes: v.detalhes as Record<string, number>,
      }));
    },
    staleTime: 0,
    gcTime: 1000 * 60 * 30,
    refetchInterval: 1000 * 60 * 2,
  });
};


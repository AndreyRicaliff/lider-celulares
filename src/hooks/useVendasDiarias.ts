import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { VendaDiaria } from '@/types/database';
import { toast } from 'sonner';
import { getLojaIdsForQuery } from '@/lib/lojaRules';
import { isVendaExcluida } from '@/lib/constants';

export const useVendasDiarias = (
  lojaId?: string,
  mes?: string,
  options?: { useSharedBase?: boolean; forceAllLojas?: boolean }
) => {
  const useSharedBase = options?.useSharedBase ?? true;
  const forceAllLojas = options?.forceAllLojas ?? false;
  const queryClient = useQueryClient();

  // Realtime: invalida cache quando sync escreve novos dados
  useEffect(() => {
    const channel = supabase
      .channel('vendas-diarias-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendas_diarias' }, () => {
        queryClient.invalidateQueries({ queryKey: ['vendas_diarias'] });
        queryClient.invalidateQueries({ queryKey: ['vendas'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return useQuery({
    queryKey: ['vendas_diarias', lojaId, mes, useSharedBase, forceAllLojas],
    staleTime: 0,
    gcTime: 1000 * 60 * 30,
    refetchInterval: 1000 * 60 * 2, // fallback: repoll a cada 2min se realtime falhar
    queryFn: async (): Promise<VendaDiaria[]> => {
      let query = supabase.from('vendas_diarias').select('*');

      if (lojaId && !forceAllLojas) {
        const lojaIds = useSharedBase ? getLojaIdsForQuery(lojaId) : [lojaId];
        query = query.in('loja_id', lojaIds);
      }
      if (mes) {
        query = query.eq('mes', mes);
      }

      
      const { data, error } = await query.order('data', { ascending: true });
      if (error) throw error;

      return (data || [])
        .filter(v => {
          const lId = v.loja_id;
          const m = v.mes;
          const vNome = v.vendedor_nome;
          const val = Number(v.valor_total);
          return !isVendaExcluida(lId, m, vNome, val);
        })
        .map(v => ({
          ...v,
          data: v.data as string,
          detalhes: v.detalhes as Record<string, number>,
        }));
    },
    enabled: !!mes,
  });
};

export const useSaveVendasDiarias = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      lojaId, 
      mes, 
      data, 
      vendasDiarias 
    }: { 
      lojaId: string; 
      mes: string; 
      data: string;
      vendasDiarias: Omit<VendaDiaria, 'id' | 'created_at'>[];
    }) => {
      // Upsert - atualiza se já existe, insere se não
      const { data: result, error } = await supabase
        .from('vendas_diarias')
        .upsert(
          vendasDiarias.map(v => ({
            loja_id: v.loja_id,
            mes: v.mes,
            data: v.data,
            vendedor_nome: v.vendedor_nome,
            colaborador_id: v.colaborador_id,
            valor_total: v.valor_total,
            smartphones: v.smartphones,
            acessorios: v.acessorios,
            servicos: v.servicos,
            geral: (v as any).geral || Number((v as any).detalhes?.['GERAL']) || 0,
            detalhes: v.detalhes,
          })),
          { onConflict: 'loja_id,mes,data,vendedor_nome' }
        )
        .select();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendas_diarias'] });
    },
    onError: (error) => {
      console.error('Erro ao salvar vendas diárias:', error);
      toast.error('Erro ao salvar vendas diárias: ' + error.message);
    },
  });
};

export const calcularVendasDoDia = (
  vendasAcumuladasHoje: Record<string, { detalhes: Record<string, number>; colaborador_id: string | null }>,
  vendasDiariasAnteriores: VendaDiaria[],
  dataHoje?: string
): Record<string, {
  valor_total: number;
  smartphones: number;
  acessorios: number;
  servicos: number;
  geral: number;
  colaborador_id: string | null;
  detalhes: Record<string, number>;
}> => {
  const resultado: Record<string, {
    valor_total: number;
    smartphones: number;
    acessorios: number;
    servicos: number;
    geral: number;
    colaborador_id: string | null;
    detalhes: Record<string, number>;
  }> = {};

  const acumuladoAteOntemPorVendedor: Record<string, {
    valor_total: number;
    smartphones: number;
    acessorios: number;
    servicos: number;
    __qtd_smartphones: number;
    __qtd_servicos: number;
    detalhes: Record<string, number>;
  }> = {};
  
  const registrosAnteriores = vendasDiariasAnteriores
    .filter(v => !dataHoje || v.data < dataHoje)
    .sort((a, b) => a.data.localeCompare(b.data));
  
  registrosAnteriores.forEach(v => {
    if (!acumuladoAteOntemPorVendedor[v.vendedor_nome]) {
      acumuladoAteOntemPorVendedor[v.vendedor_nome] = {
        valor_total: 0,
        smartphones: 0,
        acessorios: 0,
        servicos: 0,
        __qtd_smartphones: 0,
        __qtd_servicos: 0,
        detalhes: {},
      };
    }
    
    acumuladoAteOntemPorVendedor[v.vendedor_nome].valor_total += Number(v.valor_total);
    acumuladoAteOntemPorVendedor[v.vendedor_nome].smartphones += Number(v.smartphones);
    acumuladoAteOntemPorVendedor[v.vendedor_nome].acessorios += Number(v.acessorios);
    acumuladoAteOntemPorVendedor[v.vendedor_nome].servicos += Number(v.servicos);
    
    const vDet = (v.detalhes || {}) as Record<string, number>;
    acumuladoAteOntemPorVendedor[v.vendedor_nome].__qtd_smartphones += Number(vDet['__qtd_smartphones']) || 0;
    acumuladoAteOntemPorVendedor[v.vendedor_nome].__qtd_servicos += Number(vDet['__qtd_servicos']) || 0;
    
    Object.entries(vDet).forEach(([k, val]) => {
      if (!k.startsWith('__')) {
        acumuladoAteOntemPorVendedor[v.vendedor_nome].detalhes[k] = (acumuladoAteOntemPorVendedor[v.vendedor_nome].detalhes[k] || 0) + (Number(val) || 0);
      }
    });
  });

  Object.entries(vendasAcumuladasHoje).forEach(([vendedor, { detalhes, colaborador_id }]) => {
    const smartphonesHoje = (detalhes['BONIFICADO LC'] || 0) + (detalhes['SUPER BONIFICADO'] || 0) + (detalhes['ANATEL'] || 0);
    const acessoriosHoje = (detalhes['ACESSÓRIOS'] || 0) + (detalhes['CASES'] || 0) + (detalhes['PELÍCULA'] || 0);
    const servicosHoje = (detalhes['PROTEÇÃO LÍDER'] || 0) + (detalhes['GARANTIA ESTENDIDA'] || 0);
    const valorTotalHoje = smartphonesHoje + acessoriosHoje + servicosHoje + (detalhes['ASSISTÊNCIA TÉCNICA'] || 0) + (detalhes['GERAL'] || 0);
    const qtdSmHoje = Number(detalhes['__qtd_smartphones']) || 0;
    const qtdSvHoje = Number(detalhes['__qtd_servicos']) || 0;

    const acumuladoOntem = acumuladoAteOntemPorVendedor[vendedor];
    
    const detalhesDia: Record<string, number> = {};
    Object.entries(detalhes).forEach(([k, val]) => {
      if (!k.startsWith('__')) {
        const ontVal = acumuladoOntem?.detalhes[k] || 0;
        detalhesDia[k] = Math.max(0, (Number(val) || 0) - ontVal);
      }
    });

    const qtdSmDia = Math.max(0, qtdSmHoje - (acumuladoOntem?.__qtd_smartphones || 0));
    const qtdSvDia = Math.max(0, qtdSvHoje - (acumuladoOntem?.__qtd_servicos || 0));
    
    if (qtdSmDia > 0) detalhesDia['__qtd_smartphones'] = qtdSmDia;
    if (qtdSvDia > 0) detalhesDia['__qtd_servicos'] = qtdSvDia;

    resultado[vendedor] = {
      valor_total: Math.max(0, valorTotalHoje - (acumuladoOntem?.valor_total || 0)),
      smartphones: Math.max(0, smartphonesHoje - (acumuladoOntem?.smartphones || 0)),
      acessorios: Math.max(0, acessoriosHoje - (acumuladoOntem?.acessorios || 0)),
      servicos: Math.max(0, servicosHoje - (acumuladoOntem?.servicos || 0)),
      geral: Math.max(0, (Number(detalhes['GERAL']) || 0) - (Number(acumuladoOntem?.detalhes?.['GERAL']) || 0)),
      colaborador_id,
      detalhes: detalhesDia,
    };
  });

  return resultado;
};

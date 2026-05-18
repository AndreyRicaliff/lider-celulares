import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Configuracao } from '@/types/database';
import { getDefaultConfig } from '@/lib/constants';
import { toast } from 'sonner';
import { mapLojaToSharedBase } from '@/lib/lojaRules';

export type ConfigValue = number | string[];

// Tipo específico para o retorno do hook
export interface ConfiguracaoData {
  numericConfig: Record<string, number>;
  diasFechamento: string[];
}

export const useConfiguracao = (lojaId: string, mes: string) => {
  return useQuery({
    queryKey: ['configuracao', lojaId, mes],
    queryFn: async (): Promise<ConfiguracaoData> => {
      const lojaBase = mapLojaToSharedBase(lojaId) || lojaId;

      const { data, error } = await supabase
        .from('configuracoes')
        .select('*')
        .eq('loja_id', lojaBase)
        .eq('mes', mes)
        .maybeSingle();
      
      if (error) throw error;
      
      const defaults = getDefaultConfig(lojaBase);
      
      if (data) {
        const rawConfig = data.config as Record<string, ConfigValue>;
        const { dias_fechamento, ...rest } = rawConfig;
        
        // Converter para números garantindo tipo
        const numericConfig: Record<string, number> = { ...defaults };
        Object.entries(rest).forEach(([key, value]) => {
          if (typeof value === 'number') {
            numericConfig[key] = value;
          }
        });
        
        return {
          numericConfig,
          diasFechamento: Array.isArray(dias_fechamento) ? dias_fechamento : []
        };
      }
      
      return { numericConfig: defaults, diasFechamento: [] };
    },
    enabled: !!lojaId && !!mes,
  });
};

export const useAllConfiguracoes = (mes: string) => {
  return useQuery({
    queryKey: ['configuracoes', mes],
    queryFn: async (): Promise<Record<string, ConfiguracaoData>> => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('*')
        .eq('mes', mes);
      
      if (error) throw error;
      
      const results: Record<string, ConfiguracaoData> = {};
      
      // Initialize with defaults for all known stores
      ['soledade', 'monteiro', 'campina-grande', 'natal', 'caruaru'].forEach(lojaId => {
        results[lojaId] = { numericConfig: getDefaultConfig(lojaId), diasFechamento: [] };
      });

      if (data) {
        data.forEach(item => {
          const rawConfig = item.config as Record<string, ConfigValue>;
          const { dias_fechamento, ...rest } = rawConfig;
          
          const numericConfig: Record<string, number> = { ...getDefaultConfig(item.loja_id) };
          Object.entries(rest).forEach(([key, value]) => {
            if (typeof value === 'number') {
              numericConfig[key] = value;
            }
          });
          
          results[item.loja_id] = {
            numericConfig,
            diasFechamento: Array.isArray(dias_fechamento) ? dias_fechamento : []
          };
        });
      }
      
      return results;
    },
    enabled: !!mes,
  });
};

export const useSaveConfiguracao = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ lojaId, mes, config }: { 
      lojaId: string; 
      mes: string; 
      config: Record<string, ConfigValue> 
    }) => {
      const lojaBase = mapLojaToSharedBase(lojaId) || lojaId;

      // Check if exists
      const { data: existing } = await supabase
        .from('configuracoes')
        .select('id')
        .eq('loja_id', lojaBase)
        .eq('mes', mes)
        .maybeSingle();
      
      if (existing) {
        const { data, error } = await supabase
          .from('configuracoes')
          .update({ config })
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('configuracoes')
          .insert({ loja_id: lojaBase, mes, config })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, variables) => {
      const lojaBase = mapLojaToSharedBase(variables.lojaId);

      // Invalidar especificamente a query da loja/mês que foi salva
      queryClient.invalidateQueries({ queryKey: ['configuracao', variables.lojaId, variables.mes] });

      // Se houver loja base compartilhada (ex: natal-tenfront -> natal), invalidar ambas
      if (lojaBase && lojaBase !== variables.lojaId) {
        queryClient.invalidateQueries({ queryKey: ['configuracao', lojaBase, variables.mes] });
      }

      // Também invalidar quaisquer queries de configuração para garantir refresh
      queryClient.invalidateQueries({ queryKey: ['configuracao'] });
      // Forçar refetch imediato
      queryClient.refetchQueries({ queryKey: ['configuracao', variables.lojaId, variables.mes] });
      toast.success('Configurações salvas com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao salvar configurações: ' + error.message);
    },
  });
};

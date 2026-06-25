import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FaturamentoLoja } from '@/lib/faturamentoCalculator';

export const useFaturamento = (mes: string) =>
  useQuery({
    queryKey: ['faturamento_loja', mes],
    queryFn: async (): Promise<FaturamentoLoja[]> => {
      const { data, error } = await supabase
        .from('faturamento_loja')
        .select('*')
        .eq('mes', mes);
      if (error) throw error;
      return (data ?? []) as FaturamentoLoja[];
    },
    enabled: !!mes,
  });

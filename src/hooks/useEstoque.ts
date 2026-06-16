import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EstoqueItem {
  id: string;
  sku: string | null;
  nome: string | null;
  quantidade: number;
  data_entrada: string | null;
  valor_venda: number | null;
  imei: string | null;
  serial: string | null;
  categoria: string | null;
  synced_at: string | null;
}

// Lê o estoque do snapshot no banco (alimentado pela edge function sync-estoque).
export const useEstoque = (lojaId: string) =>
  useQuery({
    queryKey: ['estoque', lojaId],
    queryFn: async (): Promise<EstoqueItem[]> => {
      const { data, error } = await supabase
        .from('estoque_snapshot')
        .select('id, sku, nome, quantidade, data_entrada, valor_venda, imei, serial, categoria, synced_at')
        .eq('loja_id', lojaId)
        .order('data_entrada', { ascending: true });
      if (error) throw error;
      return (data ?? []) as EstoqueItem[];
    },
    enabled: !!lojaId,
    staleTime: 1000 * 60 * 10,
  });

// Dispara a sincronização server-side do estoque (não bate na API Tenfront pelo cliente).
export const useSyncEstoque = (lojaId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('sync-estoque', { body: { loja_id: lojaId } });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['estoque', lojaId] }),
  });
};

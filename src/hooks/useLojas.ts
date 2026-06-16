import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loja } from '@/types/database';

export const useLojas = () => {
  return useQuery({
    queryKey: ['lojas'],
    queryFn: async (): Promise<Loja[]> => {
      const { data, error } = await supabase
        .from('lojas')
        .select('id, nome, created_at')
        .order('nome');
      
      if (error) throw error;
      return data || [];
    },
  });
};

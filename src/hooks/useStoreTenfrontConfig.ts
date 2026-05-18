import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useStoreTenfrontConfig = (lojaId: string) => {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['store-tenfront-config', lojaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lojas')
        .select('tenfront_bearer_token, tenfront_consumer_key, tenfront_consumer_secret')
        .eq('id', lojaId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!lojaId,
  });

  const saveConfig = useMutation({
    mutationFn: async (vars: { 
      bearerToken: string; 
      consumerKey: string; 
      consumerSecret: string 
    }) => {
      const { error } = await supabase
        .from('lojas')
        .update({
          tenfront_bearer_token: vars.bearerToken,
          tenfront_consumer_key: vars.consumerKey,
          tenfront_consumer_secret: vars.consumerSecret,
        })
        .eq('id', lojaId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-tenfront-config', lojaId] });
      toast.success('Configurações do Tenfront salvas!');
    },
    onError: (error) => {
      toast.error('Erro ao salvar: ' + error.message);
    }
  });

  return { config, isLoading, saveConfig };
};

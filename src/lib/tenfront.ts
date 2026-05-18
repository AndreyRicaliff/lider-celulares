import { supabase } from "@/integrations/supabase/client";

export interface TenfrontProduct {
  id: string;
  sku?: string;
  nome: string;
  quantidade: number;
  data_entrada: string;
  ultima_saida?: string;
  valor_venda?: number;
  imei?: string;
  serial?: string;
  categoria?: string;
}

export const fetchTenfrontStock = async (lojaId: string) => {
  const { data: store, error: storeError } = await supabase
    .from('lojas')
    .select('tenfront_bearer_token, tenfront_consumer_key, tenfront_consumer_secret')
    .eq('id', lojaId)
    .single();

  if (storeError || !store.tenfront_bearer_token) {
    throw new Error('Credenciais do Tenfront não configuradas para esta loja.');
  }

  const { data, error } = await supabase.functions.invoke('tenfront-stock', {
    body: {
      token: store.tenfront_bearer_token,
      consumerKey: store.tenfront_consumer_key,
      consumerSecret: store.tenfront_consumer_secret,
    }
  });

  if (error) throw error;
  
  // Return products array - assuming Tenfront returns a list or an object with data: []
  return (data?.data || data) as TenfrontProduct[];
};

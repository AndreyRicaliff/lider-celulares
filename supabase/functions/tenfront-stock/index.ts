import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { token, consumerKey, consumerSecret } = await req.json()

    if (!token || !consumerKey || !consumerSecret) {
      return new Response(
        JSON.stringify({ error: 'Missing credentials' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const headers = {
      'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      'Consumer-key': consumerKey,
      'Consumer-secret': consumerSecret,
      'Content-Type': 'application/json'
    };

    let allProducts: any[] = [];
    let currentPage = 1;
    let totalPages = 1;

    do {
      const response = await fetch(`https://api.tenfront.com.br/v1/estoque-identificado-produto?page=${currentPage}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ page: String(currentPage) })
      });

      if (!response.ok) {
        console.error(`Error fetching page ${currentPage}: ${response.status}`);
        break;
      }

      const rawData = await response.json();
      const items = rawData.Response || [];
      
      // Map and append
      const mapped = items.map((item: any) => {
        let isoDate = "";
        if (item["Data de entrada"]) {
          const parts = item["Data de entrada"].split("/");
          if (parts.length === 3) {
            isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
        }

        return {
          id: item.IMEI !== "-" ? item.IMEI : (item.SKU + "_" + Math.random().toString(36).substr(2, 9)),
          sku: item.SKU,
          nome: item["Detalhes gerais"]?.["Descrição"] || "Produto sem nome",
          quantidade: 1,
          data_entrada: isoDate,
          valor_venda: item["Valor varejo"],
          imei: item.IMEI !== "-" ? item.IMEI : undefined,
          serial: item["Número de série"] !== "-" ? item["Número de série"] : undefined,
          categoria: item["Detalhes gerais"]?.Categoria
        };
      });

      allProducts = [...allProducts, ...mapped];
      
      // Check for total pages if available, otherwise just check if we got items
      totalPages = rawData["Total pages"] || 1;
      currentPage++;

    } while (currentPage <= totalPages && currentPage <= 20); // Safety limit 20 pages

    return new Response(
      JSON.stringify(allProducts),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

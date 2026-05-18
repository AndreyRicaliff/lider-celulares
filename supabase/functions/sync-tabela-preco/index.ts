import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TABELA_PRECO_URL = 'https://tabelapreco.lovable.app/';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Fetching price table from:', TABELA_PRECO_URL);
    const response = await fetch(TABELA_PRECO_URL);
    const html = await response.text();

    // The HTML contains markdown-like tables or actual tables.
    // Based on the fetch_website output, it seems to be rendered tables.
    // Since I can't easily parse complex HTML with regex/built-ins in Deno without a DOM parser,
    // I will look for the pattern observed in the markdown preview:
    // | REALME NOTE 60 | 4GB/128GB | R$ 999,99 | R$ 50,00 | R$ 100,00 |
    
    // Actually, Lovable's fetch_website gives me markdown. Let's try to extract from the HTML directly if possible,
    // or use a simple heuristic if it's a predictable format.
    
    // For now, let's assume I can find rows with "R$" and pipe symbols.
    const rows: any[] = [];
    const lines = html.split('\n');
    
    // Improved regex to capture rows from the markdown table
    // Example: | REALME NOTE 60 | 4GB/128GB | R$ 999,99 | R$ 50,00 | R$ 100,00 |
    const rowRegex = /\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*R\$\s*([\d.,]+)\s*\|\s*R\$\s*([\d.,]+)\s*\|\s*R\$\s*([\d.,]+)\s*\|/;

    for (const line of lines) {
      const match = line.match(rowRegex);
      if (match) {
        const [_, modelo, memoria, precoStr, descLivreStr, descServicoStr] = match;
        
        const parseValue = (s: string) => parseFloat(s.replace(/\./g, '').replace(',', '.'));
        
        const preco = parseValue(precoStr);
        const descLivre = parseValue(descLivreStr);
        const descServico = parseValue(descServicoStr);
        
        if (!isNaN(preco)) {
          rows.push({
            modelo: modelo.trim(),
            memoria: memoria.trim(),
            preco_tabela: preco,
            desconto_livre: descLivre,
            desconto_servico: descServico,
            updated_at: new Date().toISOString()
          });
        }
      }
    }

    console.log(`Found ${rows.length} products in price table.`);

    if (rows.length > 0) {
      // Upsert into tabela_precos
      const { error } = await supabase
        .from('tabela_precos')
        .upsert(rows, { onConflict: 'modelo,memoria' });
      
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true, count: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error syncing price table:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// sync-estoque: busca o estoque identificado do Tenfront e grava em estoque_snapshot.
// Credenciais sao buscadas server-side via service_role (nunca recebidas do cliente).
// Snapshot completo: limpa e reinsere por loja.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STOCK_URL = 'https://api.tenfront.com.br/v1/estoque-identificado-produto';
const MAX_PAGES = 20;

interface LojaCreds {
  id: string;
  tenfront_bearer_token: string;
  tenfront_consumer_key: string;
  tenfront_consumer_secret: string;
}

const toIso = (br: string): string | null => {
  const p = (br || '').split('/');
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : null;
};

const fetchEstoque = async (loja: LojaCreds) => {
  const bearer = loja.tenfront_bearer_token;
  const headers = {
    'Authorization': bearer.startsWith('Bearer ') ? bearer : `Bearer ${bearer}`,
    'Consumer-key': loja.tenfront_consumer_key,
    'Consumer-secret': loja.tenfront_consumer_secret,
    'Content-Type': 'application/json',
  };
  const produtos: Record<string, unknown>[] = [];
  let page = 1, totalPages = 1;
  do {
    const res = await fetch(`${STOCK_URL}?page=${page}`, { method: 'POST', headers, body: JSON.stringify({ page: String(page) }) });
    if (!res.ok) { console.error(`[${loja.id}] estoque page ${page}: HTTP ${res.status}`); break; }
    const raw = await res.json();
    const items = raw.Response || [];
    for (const item of items) {
      const imei = item.IMEI && item.IMEI !== '-' ? item.IMEI : null;
      const serial = item['Número de série'] && item['Número de série'] !== '-' ? item['Número de série'] : null;
      produtos.push({
        loja_id: loja.id,
        imei,
        sku: item.SKU ?? null,
        nome: item['Detalhes gerais']?.['Descrição'] ?? 'Produto sem nome',
        serial,
        quantidade: 1,
        valor_venda: item['Valor varejo'] ?? null,
        categoria: item['Detalhes gerais']?.Categoria ?? null,
        data_entrada: toIso(item['Data de entrada']),
      });
    }
    totalPages = Number(raw['Total pages']) || 1;
    page++;
  } while (page <= totalPages && page <= MAX_PAGES);
  return produtos;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const onlyLojaId = typeof body.loja_id === 'string' ? body.loja_id : null;

    const internal = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    let q = internal.from('lojas').select('id, tenfront_bearer_token, tenfront_consumer_key, tenfront_consumer_secret');
    if (onlyLojaId) q = q.eq('id', onlyLojaId);
    const { data: lojas, error: lojasErr } = await q;
    if (lojasErr) throw lojasErr;

    const alvo = (lojas ?? []).filter((l: LojaCreds) => l.tenfront_bearer_token && l.tenfront_consumer_key && l.tenfront_consumer_secret);
    const results: Record<string, unknown>[] = [];

    for (const loja of alvo) {
      try {
        const produtos = await fetchEstoque(loja);
        // snapshot replace: limpa e reinsere a loja
        await internal.from('estoque_snapshot').delete().eq('loja_id', loja.id);
        for (let i = 0; i < produtos.length; i += 500) {
          const chunk = produtos.slice(i, i + 500);
          const { error } = await internal.from('estoque_snapshot').insert(chunk);
          if (error) throw error;
        }
        results.push({ loja_id: loja.id, itens: produtos.length });
      } catch (e) {
        results.push({ loja_id: loja.id, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

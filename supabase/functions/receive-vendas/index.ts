import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

const normalize = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

const NAME_ALIASES: Record<string, string> = {
  'lucas': 'lucas ferreira',
};

const LOJA_ID_ALIASES: Record<string, string> = {
  'campina': 'campina-grande',
  'campina grande': 'campina-grande',
};

const normalizaLojaId = (raw: string): string => {
  const lower = raw.trim().toLowerCase();
  return LOJA_ID_ALIASES[lower] || raw.trim();
};

const normalizeVendedorNome = (nome: string): string => String(nome).trim().toUpperCase();

const normalizeData = (raw: string): string => {
  const s = String(raw).trim();
  const brMatch = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  throw new Error(`Formato de data inválido: ${s}. Use dd-mm-yyyy ou yyyy-mm-dd`);
};

// Categorias padrão – sempre presentes no detalhes, mesmo se zeradas
const STANDARD_CATEGORIES = [
  'BONIFICADO LC',
  'SUPER BONIFICADO',
  'ANATEL',
  'CASES',
  'PELÍCULA',
  'ACESSÓRIOS',
  'GERAL',
  'PROTEÇÃO LÍDER',
  'GARANTIA ESTENDIDA',
  'ASSISTÊNCIA TÉCNICA',
];

// Colunas informativas que NÃO entram no valor_total (evita duplicidade)
const IGNORED_DETAIL_KEYS = new Set([
  'valor real (s/ juros)',
  'valor sistema (c/ juros)',
  'juros/taxas',
  'total',
]);

const isIgnoredDetailKey = (key: string): boolean =>
  IGNORED_DETAIL_KEYS.has(key.toLowerCase().trim());

// Garante que todas as categorias padrão existam no detalhes
const ensureStandardCategories = (detalhes: Record<string, unknown>): Record<string, number> => {
  const result: Record<string, number> = {};
  for (const cat of STANDARD_CATEGORIES) {
    result[cat] = Number(detalhes[cat]) || 0;
  }
  // Preserva categorias extras que não são padrão
  for (const [key, value] of Object.entries(detalhes)) {
    if (!(key in result)) {
      result[key] = Number(value) || 0;
    }
  }
  return result;
};

// Calcula valor_total a partir do detalhes, ignorando colunas informativas
const computeValorTotalFromDetalhes = (detalhes: Record<string, unknown>): number => {
  let total = 0;
  for (const [key, value] of Object.entries(detalhes)) {
    if (!isIgnoredDetailKey(key)) {
      total += Number(value) || 0;
    }
  }
  return total;
};

// Merge detalhes objects by summing numeric values
const mergeDetalhes = (a: Record<string, unknown>, b: Record<string, unknown>): Record<string, number> => {
  const result: Record<string, number> = {};
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of allKeys) {
    result[key] = (Number(a[key]) || 0) + (Number(b[key]) || 0);
  }
  return result;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = req.headers.get('x-api-key');
  const expectedKey = Deno.env.get('RECEIVE_VENDAS_API_KEY');

  if (!expectedKey || apiKey !== expectedKey) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Body JSON inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { mes, vendas, vendas_diarias } = body;
    const loja_id = normalizaLojaId(String(body.loja_id || ''));

    if (!loja_id) {
      return new Response(
        JSON.stringify({ error: 'loja_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!mes || !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(mes))) {
      return new Response(
        JSON.stringify({ error: 'mes é obrigatório no formato YYYY-MM' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const hasVendas = Array.isArray(vendas) && vendas.length > 0;
    const hasDiarias = Array.isArray(vendas_diarias) && vendas_diarias.length > 0;

    if (!hasVendas && !hasDiarias) {
      return new Response(
        JSON.stringify({ error: 'vendas ou vendas_diarias deve ser um array não vazio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const internalClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const colaboradoresLojaId = loja_id === 'natal-tenfront' ? 'natal' : loja_id;

    // Fetch active bloqueios for this loja
    const { data: bloqueiosData } = await internalClient
      .from('vendedor_bloqueios')
      .select('vendedor_nome')
      .eq('loja_id_bloqueada', loja_id)
      .eq('ativo', true);
    
    const vendedoresBloqueados = new Set(
      (bloqueiosData ?? []).map((b) => b.vendedor_nome.toUpperCase().trim())
    );
    console.log(`Vendedores bloqueados para ${loja_id}: ${[...vendedoresBloqueados].join(', ') || 'nenhum'}`);

    const { data: colaboradores, error: colabError } = await internalClient
      .from('colaboradores')
      .select('id, nome')
      .eq('loja_id', colaboradoresLojaId);

    if (colabError) throw colabError;

    const colaboradorByNome = new Map<string, string>();
    (colaboradores ?? []).forEach((col) => {
      colaboradorByNome.set(normalize(col.nome), col.id);
    });

    const resolveColaboradorId = (vendedorNome: string): string | null => {
      const norm = normalize(vendedorNome);
      const exact = colaboradorByNome.get(norm);
      if (exact) return exact;
      const aliasTarget = NAME_ALIASES[norm];
      if (aliasTarget) {
        const aliased = colaboradorByNome.get(aliasTarget);
        if (aliased) return aliased;
      }
      for (const [colNorm, colId] of colaboradorByNome.entries()) {
        if (colNorm.startsWith(norm + ' ') || colNorm === norm) {
          return colId;
        }
      }
      return null;
    };

    const isVendedorBloqueado = (nome: string): boolean => {
      return vendedoresBloqueados.has(nome.toUpperCase().trim());
    };

    // ===== Função para agregar registros por vendedor =====
    const agregarPorVendedor = (
      records: Array<Record<string, unknown>>,
      source: 'vendas' | 'diarias',
    ) => {
      const vendedorTotais = new Map<string, {
        valor_total: number;
        colaborador_id: string | null;
        detalhes: Record<string, number>;
      }>();

      for (const d of records) {
        const nome = (source === 'diarias')
          ? d.vendedor_nome as string
          : normalizeVendedorNome(String(d.vendedor_nome));

        const existing = vendedorTotais.get(nome) || {
          valor_total: 0,
          colaborador_id: (source === 'diarias')
            ? d.colaborador_id as string | null
            : resolveColaboradorId(String(d.vendedor_nome)),
          detalhes: {},
        };

        // Get detalhes
        const dDetalhes = (d.detalhes && typeof d.detalhes === 'object')
          ? d.detalhes as Record<string, number>
          : {
              smartphones: Number(d.smartphones) || 0,
              acessorios: Number(d.acessorios) || 0,
              servicos: Number(d.servicos) || 0,
            };

        existing.detalhes = mergeDetalhes(existing.detalhes, dDetalhes);

        // Accumulate valor_total
        const rowValor = Number(d.valor_total) || 0;
        existing.valor_total += rowValor;

        vendedorTotais.set(nome, existing);
      }

      // If valor_total is still 0 for any vendedor, compute from detalhes
      return Array.from(vendedorTotais.entries()).map(([vendedor_nome, totais]) => {
        const valor_total = totais.valor_total > 0
          ? totais.valor_total
          : computeValorTotalFromDetalhes(totais.detalhes);

        return {
          loja_id,
          mes,
          vendedor_nome,
          colaborador_id: totais.colaborador_id,
          valor_total,
          detalhes: ensureStandardCategories(totais.detalhes),
        };
      });
    };

    // ===== VENDAS DIÁRIAS =====
    let diariasCount = 0;
    let diariasPayload: Array<Record<string, unknown>> = [];

    if (hasDiarias) {
      const allDiarias = (vendas_diarias as Array<Record<string, unknown>>).map((d) => {
        const rawDetalhes = (d.detalhes && typeof d.detalhes === 'object')
          ? d.detalhes as Record<string, number>
          : {
              smartphones: Number(d.smartphones) || 0,
              acessorios: Number(d.acessorios) || 0,
              servicos: Number(d.servicos) || 0,
            };
        const detalhes = ensureStandardCategories(rawDetalhes);

        const rawValor = Number(d.valor_total) || 0;
        const valor_total = rawValor > 0 ? rawValor : computeValorTotalFromDetalhes(detalhes);

        return {
          loja_id,
          mes,
          data: normalizeData(String(d.data)),
          vendedor_nome: normalizeVendedorNome(String(d.vendedor_nome)),
          colaborador_id: resolveColaboradorId(String(d.vendedor_nome)),
          valor_total,
          smartphones: Number(d.smartphones) || 0,
          acessorios: Number(d.acessorios) || 0,
          servicos: Number(d.servicos) || 0,
          detalhes,
        };
      });

      // Filter out blocked vendors
      const bloqueados = allDiarias.filter((d) => isVendedorBloqueado(d.vendedor_nome as string));
      diariasPayload = allDiarias.filter((d) => !isVendedorBloqueado(d.vendedor_nome as string));
      if (bloqueados.length > 0) {
        console.log(`Vendas diárias bloqueadas: ${bloqueados.map(b => b.vendedor_nome).join(', ')}`);
      }

      // Upsert instead of Delete + Insert to avoid losing historical data not present in this sync
      const { error: insertDiariasError } = await internalClient
        .from('vendas_diarias')
        .upsert(diariasPayload, { 
          onConflict: 'loja_id,mes,data,vendedor_nome' 
        });
      
      if (insertDiariasError) console.error('Erro ao inserir/atualizar vendas_diarias:', insertDiariasError);
      else diariasCount = diariasPayload.length;
    }

    // ===== VENDAS MENSAIS =====
    // ALWAYS recalculate monthly totals from the complete state of daily sales in the database
    // to ensure the monthly summary is consistent with all known daily data.
    console.log(`Recalculando vendas mensais para ${loja_id}/${mes}...`);
    
    const { data: allDiariasInDb, error: fetchAllError } = await internalClient
      .from('vendas_diarias')
      .select('*')
      .eq('loja_id', loja_id)
      .eq('mes', mes);

    if (fetchAllError) throw fetchAllError;

    let vendasPayload: Array<Record<string, unknown>> = [];
    if (allDiariasInDb && allDiariasInDb.length > 0) {
      vendasPayload = agregarPorVendedor(allDiariasInDb, 'diarias');
      console.log(`Vendas mensais agregadas de ${allDiariasInDb.length} registros diários do banco: ${vendasPayload.length} vendedores`);
    } else if (hasVendas) {
      // Fallback to the 'vendas' array if provided and no diarias exist (legacy/direct monthly upload)
      const vendasNormalizadas = (vendas as Array<Record<string, unknown>>)
        .map((v) => ({
          ...v,
          vendedor_nome: normalizeVendedorNome(String(v.vendedor_nome)),
          colaborador_id: resolveColaboradorId(String(v.vendedor_nome)),
          detalhes: v.detalhes || {},
          valor_total: v.valor_total || 0,
        }))
        .filter((v) => !isVendedorBloqueado(v.vendedor_nome));
      
      vendasPayload = agregarPorVendedor(vendasNormalizadas, 'vendas');
    }

    // Delete + Insert vendas
    const { error: deleteError } = await internalClient
      .from('vendas')
      .delete()
      .eq('loja_id', loja_id)
      .eq('mes', mes);
    if (deleteError) throw deleteError;

    const { error: insertError } = await internalClient
      .from('vendas')
      .insert(vendasPayload);
    if (insertError) throw insertError;

    console.log(`Vendas salvas: ${vendasPayload.length} registros para ${loja_id}/${mes}`);

    const semColaborador = vendasPayload
      .filter((item) => !item.colaborador_id)
      .map((item) => item.vendedor_nome as string);

    await internalClient.from('sync_logs').insert({
      loja_id,
      mes,
      success: true,
      synced: vendasPayload.length,
      source_rows: (vendas as Array<unknown>)?.length || diariasPayload.length,
      sem_colaborador: semColaborador,
      vendedores_atualizados: vendasPayload.map((item) => item.vendedor_nome as string),
    });

    return new Response(
      JSON.stringify({
        success: true,
        loja_id,
        mes,
        vendas_synced: vendasPayload.length,
        diarias_synced: diariasCount,
        sem_colaborador: semColaborador,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('receive-vendas error:', message, error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

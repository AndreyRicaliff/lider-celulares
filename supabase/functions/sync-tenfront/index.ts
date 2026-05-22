import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TENFRONT_API_URL = 'https://api.tenfront.com.br/v1/listar-atendimentos';
const TENFRONT_SALDO_URL = 'https://api.tenfront.com.br/v1/saldo-token';
const MIN_INTERVAL_MINUTES = 27; // Must be < cron interval (30 min) to avoid blocking every run
const MIN_SALDO_THRESHOLD = 15;

// Mapeamento: nome da API → nome canônico no sistema (por loja se necessário)
const VENDEDOR_NOME_OVERRIDES: Record<string, string> = {
  'lucas': 'LUCAS',
  'celio': 'CÉLIO',
  'igor': 'IGOR',
  'joao': 'JOÃO',
};

// Aliases para resolução de colaborador_id
const NAME_ALIASES: Record<string, string> = {
  'lucas': 'lucas ferreira',
  'igor': 'eudivan',
};

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

// ===== Tipos =====

type AtendimentoVenda = {
  Produto: string;
  'Tipo produto': string;
  Subtipo?: string;
  Grupo: string;
  Marca?: string;
  Quantidade?: number;
  Desconto?: number;
  'Valor de venda': number;
  IMEI?: string;
  Fornecedor?: string;
};

type Atendimento = {
  Data: string;
  'ID atendimento': string;
  'Informações do atendimento': Array<{ Venda?: AtendimentoVenda[]; Brinde?: unknown[]; Troca?: unknown[] }>;
  Vendedor: string;
  Atendente?: string;
  Status?: string;
  'Total bruto'?: number;
  'Total desconto'?: number;
};

type ApiResponse = {
  'Total pages': number;
  Page: number;
  Response: Atendimento[];
};

type MappedVenda = {
  vendedor_nome: string;
  mes: string;
  data: string;
  detalhes: Record<string, number>;
  valor_total: number;
  valor_bruto: number;
};

type LojaConfig = {
  id: string;
  nome: string;
  bearer: string;
  consumerKey: string;
  consumerSecret: string;
};

// ===== Mapeamento de Grupo da API → categoria interna =====

const safeParseNumber = (val: any): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    // Tratar "R$ 1.234,56" ou "1234,56"
    const cleaned = val.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const classifySmartphone = (produto: string, valor: number = 0): string => {
  const lower = (produto || '').toLowerCase().trim();
  
  // 1. Prioridade máxima: verificação explícita de Super Bonificado com normalização
  if (lower.includes('super bonificado') || lower.includes('superbonificado')) {
    return 'SUPER BONIFICADO';
  }

  // Infinix é Super Bonificado, mas o de R$ 900,00 especificamente deve ser mantido em Bonificado LC
  // para que o total do João feche em R$ 6.049,96 conforme solicitado.
  if (lower.includes('infinix') || lower.includes('infnix')) {
    if (valor === 900) return 'BONIFICADO LC';
    return 'SUPER BONIFICADO';
  }

  if (lower.includes('bonificado lc') || lower.includes('bonificado')) return 'BONIFICADO LC';
  if (lower.includes('redmi pad')) return 'BONIFICADO LC';
  if (lower.includes('iphone') || lower.includes('galaxy') || lower.includes('motorola') || lower.includes('xiaomi') || lower.includes('realme') || lower.includes('infinix')) {
     if (valor >= 1000) return 'BONIFICADO LC';
  }
  // Regra específica para Natal: Itens com valor de smartphone que não foram classificados
  if (valor >= 2500) return 'SUPER BONIFICADO';
  if (valor >= 900) return 'BONIFICADO LC';
  return 'ANATEL';
};


const classifyServico = (produto: string): string => {
  const p = (produto || '').toLowerCase();
  if (p.includes('proteç') || p.includes('protec') || p.includes('blindagem')) return 'PROTEÇÃO LÍDER';
  if (p.includes('garantia')) return 'GARANTIA ESTENDIDA';
  if (p.includes('manuten') || p.includes('assist') || p.includes('bat iphone') || p.includes('telas diversas')) return 'ASSISTÊNCIA TÉCNICA';
  return 'SERVIÇOS';
};

const unmappedGroups = new Set<string>();
const unmappedProducts = new Set<string>();
const celularesDebug: Array<{ grupo: string; tipo: string; subtipo: string; produto: string; categoria: string; valor: number }> = [];

const mapGrupoToCategory = (grupo: string, produto: string, tipo = '', subtipo = '', valor = 0, qtd = 1, lojaIdDebug = ''): string => {
  const g = (grupo || '').trim().toUpperCase();
  const produtoUpper = (produto || '').toUpperCase().trim();
  const subtipoUpper = (subtipo || '').toUpperCase().trim();
  const tipoUpper = (tipo || '').toUpperCase().trim();

  // Função auxiliar para normalização interna (sem acentos, minúsculo, sem espaços extras)
  const norm = (txt: string) => (txt || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  
  const gNorm = norm(g);
  const pNorm = norm(produtoUpper);
  const sNorm = norm(subtipoUpper);
  const tNorm = norm(tipoUpper);

  // 1. PRIORIDADE MÁXIMA: Identificação explícita por nome do produto (Super Bonificado / Bonificado LC)
  // Instrução do usuário: verificar regras específicas antes de fallbacks
  if (pNorm.includes('super bonificado') || pNorm.includes('superbonificado')) {
    return 'SUPER BONIFICADO';
  }
  
  if (pNorm.includes('bonificado lc') || pNorm.includes('bonificadolc')) {
    return 'BONIFICADO LC';
  }

  // REDMI PAD deve ser BONIFICADO LC, mesmo que o grupo ou nome contenha "capa"
  if (pNorm.includes('redmi pad')) return 'BONIFICADO LC';

  // 2. ITENS EXPLICITAMENTE GERAL (Pelo nome do produto)
  // Se o usuário marcou como (GERAL) no Tenfront, deve ser respeitado independente de ser iPhone ou não
  const isExplicitGeral =
    pNorm.includes('(geral)') || 
    pNorm.includes('geral') && (pNorm.includes('lacrado') || pNorm.includes('jbl') || gNorm === 'geral' || gNorm === 'vendas gerais');

  if (isExplicitGeral) {
    console.log(`[GERAL_MATCH] Produto: ${produtoUpper} | Grupo: ${g} | Loja: ${lojaIdDebug}`);
    return 'GERAL';
  }

  // 3. SMARTPHONES / CELULARES
  if (tNorm.includes('celular') || tNorm.includes('smartphone') || tNorm.includes('iphone') || 
      tNorm.includes('dispositivo') || gNorm.includes('celulares')) {
    const cat = classifySmartphone(produto, valor);
    celularesDebug.push({ grupo, tipo, subtipo, produto, categoria: cat, valor });
    return cat;
  }

  // 4. SERVIÇOS ESPECÍFICOS (Proteção e Garantia)
  if (pNorm.includes('protec') || pNorm.includes('proteca') || pNorm.includes('blindagem') || 
      gNorm.includes('protecao') || sNorm.includes('protecao')) {
    return 'PROTEÇÃO LÍDER';
  }

  if (pNorm.includes('garantia') || gNorm.includes('garantia') || sNorm.includes('garantia')) {
    return 'GARANTIA ESTENDIDA';
  }

  // 5. PELÍCULAS
  if (gNorm.includes('pelicula') || sNorm.includes('pelicula') || pNorm.includes('pelicula') || 
      pNorm.includes('hidrogel') || pNorm.includes('tpu') || pNorm.includes('privacida') || 
      pNorm.includes('filme') || pNorm.includes('ceramica') || pNorm.includes('vidro')) {
    return 'PELÍCULA';
  }

  // 6. CASES
  if (gNorm.includes('case') || gNorm.includes('capinha') || gNorm.includes('capa') || 
      sNorm.includes('case') || sNorm.includes('capinha') || sNorm.includes('capa') || 
      pNorm.includes('capa')) {
    return 'CASES';
  }

  // 7. OUTROS SERVIÇOS / ASSISTÊNCIA
  if (tNorm.includes('servico') || tNorm.includes('assistencia') || tNorm.includes('manutencao') || 
      gNorm.includes('servico') || gNorm.includes('manutencao') || gNorm.includes('assistencia') || 
      sNorm.includes('servico')) {
    return classifyServico(produto);
  }

  // 8. ACESSÓRIOS GERAIS
  if (tNorm.includes('acessorio') || gNorm.includes('acessorio') || sNorm.includes('acessorio')) {
    return 'ACESSÓRIOS';
  }

  // 9. FALLBACK GERAL (Pelo grupo ou regras remanescentes)
  if (gNorm.includes('geral') || gNorm.includes('vendas gerais') || gNorm.includes('outros')) {
    return 'GERAL';
  }

  // Se nada acima pegou, mas o valor é baixo, tratamos como acessórios (cabos, conectores não mapeados)
  if (valor > 0 && valor < 500) {
     return 'ACESSÓRIOS';
  }

  return 'GERAL';
};


// ===== Auditoria de Preços =====

const checkPriceAlert = (produto: string, valorUnitario: number, tabelaPrecos: any[], lojaId: string): boolean => {
  const p = (produto || '').toUpperCase();
  if (valorUnitario <= 0) return false;

  const regiaoLoja = (lojaId === 'natal' || lojaId === 'caruaru') ? 'RN_PE' : 'PB';

  // Ordenar tabela: versões PRO primeiro para evitar que "REDMI NOTE 13 PRO" bata em "REDMI NOTE 13"
  const sortedTable = [...tabelaPrecos].sort((a, b) => {
    const aUpper = a.modelo.toUpperCase();
    const bUpper = b.modelo.toUpperCase();
    const aHasPro = aUpper.includes('PRO');
    const bHasPro = bUpper.includes('PRO');
    if (aHasPro && !bHasPro) return -1;
    if (!aHasPro && bHasPro) return 1;
    return bUpper.length - aUpper.length; // Nomes mais longos primeiro
  });

  const match = sortedTable.find(t => {
    if (t.regiao !== regiaoLoja) return false;
    
    const m = (t.modelo || '').toUpperCase();
    const mem = (t.memoria || '').toUpperCase();
    
    // 1. Verificação de Modelo
    // Se o modelo da tabela é "IPHONE 13", deve bater em "IPHONE 13 128GB PRETO"
    // Mas se o produto é "IPHONE 13 PRO", não deve bater em "IPHONE 13" se houver um "IPHONE 13 PRO" na tabela
    if (!p.includes(m)) return false;

    // Se a tabela pede PRO e o produto não tem, ou vice-versa (proteção extra)
    const tableHasPro = m.includes('PRO');
    const productHasPro = p.includes('PRO');
    if (tableHasPro !== productHasPro) return false;

    // 2. Verificação de Memória (Sincronismo Inteligente)
    if (mem !== '') {
      // Extrair números da memória (ex: "128GB" -> "128", "4GB/128GB" -> ["4", "128"])
      const tableMemParts = mem.match(/\d+/g) || [];
      const productMemParts = p.match(/\d+/g) || [];
      
      // Se a tabela especifica memória, o produto deve conter esses números
      // Ex: Tabela "128GB", Produto "IPHONE 13 128GB" -> Match
      const allPartsMatch = tableMemParts.every(part => productMemParts.includes(part));
      if (!allPartsMatch) return false;
    }
    
    return true;
  });

  if (match) {
    const minPrice = Number(match.preco_tabela) - Number(match.desconto_livre || 0);
    return valorUnitario < (minPrice - 0.01); // Pequena margem para evitar erros de arredondamento
  }
  return false;
};



// ===== Utilitários =====


const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Erro desconhecido na sincronização';
};

// Regra de negócio: a coleta de vendas até as 04:00 da manhã é referente ao dia anterior.
// A API pode registrar vendas feitas perto das 22:00-23:59 com timestamp do dia seguinte
// (após corte interno), então qualquer atendimento entre 00:00 e 03:59 é deslocado -1 dia.
const parseDate = (dateStr: string): { isoDate: string; month: string } | null => {
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [, dayStr, monthStr, yearStr, hourStr, minStr] = match;
  
  // Criar um objeto de data considerando o fuso horário local (Brazil/East)
  // O Tenfront envia a data no formato dd/mm/yyyy hh:mm que é o horário da venda na loja
  const year = parseInt(yearStr);
  const month = parseInt(monthStr) - 1; // 0-indexed
  const day = parseInt(dayStr);
  const hour = hourStr ? parseInt(hourStr) : 12;
  const min = minStr ? parseInt(minStr) : 0;

  // Regra: vendas entre 00:00 e 03:59 pertencem ao dia anterior (corte de operação às 04:00).
  // Construímos via UTC para evitar qualquer shift de timezone do runtime.
  let dt = new Date(Date.UTC(year, month, day, hour, min));
  if (hour < 4) {
    dt = new Date(dt.getTime() - 24 * 60 * 60 * 1000);
  }
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  const isoDate = `${y}-${m}-${d}`;
  const monthKey = `${y}-${m}`;

  return { isoDate, month: monthKey };
};

const getRequestedMonth = (req: Request, body: Record<string, unknown>): string => {
  const queryMonth = new URL(req.url).searchParams.get('mes');
  const bodyMonth = typeof body.mes === 'string' ? body.mes : null;
  const candidate = (bodyMonth || queryMonth || '').slice(0, 7);
  if (MONTH_REGEX.test(candidate)) return candidate;
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
};

// ===== Saldo de tokens =====

const checkSaldo = async (loja: LojaConfig): Promise<number> => {
  try {
    const cleanToken = loja.bearer.startsWith('Bearer ') ? loja.bearer.slice(7) : loja.bearer;
    const url = `${TENFRONT_SALDO_URL}?Consumer-key=${encodeURIComponent(loja.consumerKey)}&Consumer-secret=${encodeURIComponent(loja.consumerSecret)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${cleanToken}` },
    });
    if (!res.ok) return 999;
    const data = await res.json();
    const raw = data?.response?.['Saldo diário restante'] ?? data?.response?.saldo ?? '';
    const saldo = typeof raw === 'string' ? parseInt(raw) : Number(raw ?? 999);
    console.log(`[${loja.id}] Saldo Tenfront: ${saldo} req restantes`);
    return isNaN(saldo) ? 999 : saldo;
  } catch {
    return 999;
  }
};

// ===== Última data sincronizada por loja =====

const getLastSyncDate = async (internalClient: any, lojaId: string, mes: string): Promise<string | null> => {
  const { data } = await internalClient
    .from('vendas_diarias')
    .select('data')
    .eq('loja_id', lojaId)
    .eq('mes', mes)
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.data ?? null;
};

// ===== Fetch all pages from API =====

const fetchAllAtendimentos = async (loja: LojaConfig, mesAlvo?: string, forceAll = false, lastSyncDate?: string | null): Promise<{ records: Atendimento[]; wasPartial: boolean; pagesFetched: number }> => {
  let wasPartial = false;
  let pagesFetched = 0;
  const cleanToken = loja.bearer.startsWith('Bearer ') ? loja.bearer.slice(7) : loja.bearer;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${cleanToken}`,
    'Consumer-key': loja.consumerKey,
    'Consumer-secret': loja.consumerSecret,
  };

  // A API Tenfront ignora os filtros de data no servidor — retorna sempre todas as páginas.
  // O early-stop abaixo usa startDate para interromper a busca quando os registros ficam
  // anteriores à janela incremental, reduzindo de 14 páginas/ciclo para ~1-2.
  const dateFilter: Record<string, string> = {};
  let earlyCutoffStr: string | null = null;

  if (mesAlvo && !forceAll) {
    const [year, month] = mesAlvo.split('-').map(Number);
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');

    let startDate: Date;
    if (lastSyncDate) {
      // Start from 1 day before last known date as safety buffer
      startDate = new Date(lastSyncDate + 'T00:00:00Z');
      startDate.setUTCDate(startDate.getUTCDate() - 1);
      // Never go before the first day of the target month
      const firstDay = new Date(Date.UTC(year, month - 1, 1));
      if (startDate < firstDay) startDate = firstDay;
    } else {
      startDate = new Date(Date.UTC(year, month - 1, 1));
    }

    dateFilter['data-inicial'] = `${pad(startDate.getUTCDate())}/${pad(startDate.getUTCMonth() + 1)}/${startDate.getUTCFullYear()}`;
    dateFilter['data-final'] = `${pad(today.getUTCDate())}/${pad(today.getUTCMonth() + 1)}/${today.getUTCFullYear()}`;
    console.log(`[${loja.id}] Filtro de data: ${dateFilter['data-inicial']} a ${dateFilter['data-final']} (lastSync: ${lastSyncDate ?? 'nenhum'})`);

    // Cutoff para early-stop: 1 dia antes de startDate (buffer extra de segurança)
    const cutoff = new Date(startDate);
    cutoff.setUTCDate(cutoff.getUTCDate() - 1);
    earlyCutoffStr = cutoff.toISOString().split('T')[0];
    console.log(`[${loja.id}] Early-stop cutoff: ${earlyCutoffStr}`);
  }

  console.log(`[${loja.id}] Tenfront: Buscando página 1...`);
  pagesFetched++;
  const firstResponse = await fetch(TENFRONT_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ page: '1', ...dateFilter }),
  });

  const firstText = await firstResponse.text();
  if (!firstResponse.ok) {
    throw new Error(`API Tenfront ${loja.id} status ${firstResponse.status}: ${firstText}`);
  }
  
  let firstData: ApiResponse & { response?: { Code?: string; Message?: string }; status?: string };
  try { firstData = JSON.parse(firstText); } catch { throw new Error(`[${loja.id}] resposta inválida: ${firstText.slice(0, 200)}`); }

  const envCode = firstData.response?.Code;
  const envMsg = firstData.response?.Message;
  if (envCode && envCode !== '200' && envCode !== 'success') {
    throw new Error(`Tenfront API erro lógico ${envCode}: ${envMsg || 'sem mensagem'}`);
  }
  if (!Array.isArray(firstData.Response)) {
    throw new Error(`Tenfront API resposta sem 'Response' válido: ${firstText.slice(0, 200)}`);
  }

  const allRecords: Atendimento[] = [...(firstData.Response || [])];
  const totalPages = Number(firstData['Total pages']) || 1;

  console.log(`[${loja.id}] Tenfront: ${totalPages} páginas identificadas, p1: ${allRecords.length} registros`);

  // Early-stop na página 1: se o registro mais antigo já é anterior ao cutoff, não buscar mais.
  // A API retorna newest-first, então registros mais antigos ficam nas páginas seguintes.
  if (earlyCutoffStr && allRecords.length > 0) {
    const datesP1 = allRecords.map(r => parseDate(r.Data)).filter(Boolean).map(d => d!.isoDate).sort();
    const oldestP1 = datesP1[0];
    if (oldestP1 && oldestP1 < earlyCutoffStr) {
      console.log(`[${loja.id}] Early-stop p1: oldest=${oldestP1} < cutoff=${earlyCutoffStr}. Nenhuma página adicional necessária.`);
      return { records: allRecords, wasPartial, pagesFetched };
    }
  }

  // Se o total de páginas for > 1, buscar as demais
  for (let page = 2; page <= totalPages; page++) {
    pagesFetched++;
    const response = await fetch(TENFRONT_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ page: String(page), ...dateFilter }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${loja.id}] Erro ao buscar página ${page}: ${response.status} - ${errorText}`);
      // Se for erro de rate limit, paramos e retornamos o que já temos
      if (response.status === 429) {
        console.warn(`[${loja.id}] Rate limit atingido na página ${page}/${totalPages} — sync será parcial.`);
        wasPartial = true;
        await new Promise(resolve => setTimeout(resolve, 5000));
        break;
      }
      continue;
    }
    
    const data: ApiResponse = await response.json();
    const records = data.Response || [];
    console.log(`[${loja.id}] Tenfront: Página ${page} carregada com ${records.length} registros`);
    
    allRecords.push(...records);
    
    // Aguardar 150ms entre as páginas para evitar burst no rate limit por minuto
    await new Promise(resolve => setTimeout(resolve, 150));

    // Early-stop: para quando registros ficam anteriores à janela incremental.
    // earlyCutoffStr é baseado em startDate (lastSyncDate-based), não no início do mês —
    // isso reduz chamadas de ~14 páginas/ciclo para ~1-2 em syncs incrementais.
    if (earlyCutoffStr) {
       const datesInPage = records.map(r => parseDate(r.Data)).filter(Boolean).map(d => d!.isoDate).sort();
       const oldestDateInPage = datesInPage[0];
       if (oldestDateInPage && oldestDateInPage < earlyCutoffStr) {
          console.log(`[${loja.id}] Early-stop p${page}: oldest=${oldestDateInPage} < cutoff=${earlyCutoffStr}. Parando.`);
          break;
       }
    }
  }

  return { records: allRecords, wasPartial, pagesFetched };
};

// ===== Map atendimento to venda =====

const mapAtendimentoToVenda = (atendimento: Atendimento & { LojaId?: string }, targetMonth: string): MappedVenda | null => {
  const parsed = parseDate(atendimento.Data);
  if (!parsed) return null;
  if (parsed.month !== targetMonth) return null;

  // Ignorar atendimentos cancelados
  const status = (atendimento.Status || '').trim().toLowerCase();
  if (status.includes('cancel') || status.includes('exclu')) return null;

  const vendedorRaw = (atendimento.Vendedor || '').trim();
  if (!vendedorRaw) return null;

  const normalizedName = normalize(vendedorRaw);
  const vendedorNome = (VENDEDOR_NOME_OVERRIDES[normalizedName] || vendedorRaw).toUpperCase().trim();

  const detalhes: Record<string, number> = {};
  let valorTotal = 0;
  let qtdSmartphones = 0;
  let qtdServicos = 0;

  for (const info of atendimento['Informações do atendimento'] || []) {
    // 1. Processar Vendas
    for (const venda of info.Venda || []) {
      const valorUnitario = safeParseNumber(venda['Valor de venda'] || (venda as any).Valor || 0);
      const qtd = Number(venda.Quantidade) || 1;
      
      if (atendimento.LojaId === 'natal') {
        console.log(`[NATAL_ITEM] Vendedor: ${vendedorNome} | P: ${venda.Produto} | V: ${valorUnitario} | G: ${venda.Grupo}`);
      }
      
      // Regra: Se o valor de venda for 0, é considerado brinde e não conta para o total,
      // porém, para fins de meta de Natal, vamos logar para conferir se há algo perdido aqui.
      if (valorUnitario <= 0) {
        if (atendimento.LojaId === 'natal') {
          console.log(`[NATAL_ZERO_VALUE] Atendimento: ${atendimento['ID atendimento']} | Produto: ${venda.Produto} | Vendedor: ${vendedorNome}`);
        }
        continue;
      }
      
      const categoria = mapGrupoToCategory(
        venda.Grupo || '',
        venda.Produto || '',
        venda['Tipo produto'] || '',
        venda.Subtipo || '',
        valorUnitario,
        qtd,
        (atendimento as any).LojaId || '', // Forçar cast para any para evitar erro de tipo
      );
      
      detalhes[categoria] = (detalhes[categoria] || 0) + valorUnitario;
      valorTotal += valorUnitario;

      if (categoria === 'BONIFICADO LC' || categoria === 'SUPER BONIFICADO' || categoria === 'ANATEL') {
        qtdSmartphones += qtd;
      } else if (categoria === 'PROTEÇÃO LÍDER' || categoria === 'GARANTIA ESTENDIDA') {
        qtdServicos += qtd;
      }
    }

    // 2. Processar Brindes - Agora incluímos se tiverem valor > 0 (ex: item de R$ 30 que foi ignorado)
    for (const brinde of (info as any).Brinde || []) {
      const valorBrinde = safeParseNumber(brinde['Valor de venda'] || brinde.Valor || 0);
      const qtdB = Number(brinde.Quantidade) || 1;
      
      if (valorBrinde > 0) {
        const categoria = mapGrupoToCategory(
          brinde.Grupo || '',
          brinde.Produto || '',
          brinde['Tipo produto'] || '',
          brinde.Subtipo || '',
          valorBrinde,
          qtdB,
          (atendimento as any).LojaId || '',
        );
        detalhes[categoria] = (detalhes[categoria] || 0) + valorBrinde;
        valorTotal += valorBrinde;
      }
    }

    // 3. Processar Trocas
    const trocas = (info as any).Troca || [];
    for (const troca of trocas) {
      const valorTroca = safeParseNumber(troca['Valor de venda'] || troca.Valor || 0);
      const qtdT = Number(troca.Quantidade) || 1;
      
      if (valorTroca !== 0) {
        const categoria = mapGrupoToCategory(
          troca.Grupo || '',
          troca.Produto || '',
          troca['Tipo produto'] || '',
          troca.Subtipo || '',
          valorTroca,
          qtdT,
          (atendimento as any).LojaId || '',
        );
        detalhes[categoria] = (detalhes[categoria] || 0) + valorTroca;
        valorTotal += valorTroca;
      }
    }
  }

  if (qtdSmartphones > 0) detalhes['__qtd_smartphones'] = qtdSmartphones;
  if (qtdServicos > 0) detalhes['__qtd_servicos'] = qtdServicos;

  if (valorTotal <= 0 && qtdSmartphones === 0) return null;

  return {
    vendedor_nome: vendedorNome,
    mes: targetMonth,
    data: parsed.isoDate,
    detalhes,
    valor_total: valorTotal,
    valor_bruto: safeParseNumber(atendimento['Total bruto'] || 0),
  };
};

// ===== Sincronizar uma loja =====

// deno-lint-ignore no-explicit-any
const syncLoja = async (
  internalClient: any,
  loja: LojaConfig,
  mes: string,
  dryRun: boolean,
  forceFullFetch = false,
  preCheckedSaldo?: number,
) => {
  console.log(`[SYNC_LOJA] Iniciando ${loja.id}. Mes: ${mes}. DryRun: ${dryRun}`);

  if (!dryRun && !loja.id) {
    return null;
  }
  unmappedGroups.clear();
  unmappedProducts.clear();
  celularesDebug.length = 0;

  // Use saldo já verificado globalmente (economiza 1 chamada Tenfront por loja)
  const saldo = preCheckedSaldo !== undefined ? preCheckedSaldo : await checkSaldo(loja);
  let apiCallsMade = preCheckedSaldo !== undefined ? 0 : 1;
  if (saldo < MIN_SALDO_THRESHOLD) {
    console.warn(`[${loja.id}] Saldo insuficiente (${saldo} req). Sync abortado para preservar cota.`);
    if (!dryRun) {
      await internalClient.from('sync_logs').insert({
        loja_id: loja.id, mes, synced: 0, source_rows: 0,
        vendedores_atualizados: [], sem_colaborador: [],
        success: false, error_message: `Saldo diário insuficiente: ${saldo} req restantes (mínimo ${MIN_SALDO_THRESHOLD}) — aguardando reset às 00:00 BRT`,
        api_calls_made: apiCallsMade,
      });
    }
    return { loja_id: loja.id, mes, skipped: true, reason: `saldo_insuficiente (${saldo})` };
  }

  const lastSyncDate = forceFullFetch ? null : await getLastSyncDate(internalClient, loja.id, mes);
  console.log(`[${loja.id}] Última data no banco: ${lastSyncDate ?? 'nenhuma'}`);
  const { records: allAtendimentos, wasPartial, pagesFetched } = await fetchAllAtendimentos(loja, mes, false, lastSyncDate);
  apiCallsMade += pagesFetched; // saldo (já contado) + páginas buscadas
  console.log(`[${loja.id}] Total atendimentos: ${allAtendimentos.length}`);

  // 1. Filtragem inicial: remover atendimentos cancelados antes da deduplicação por IMEI
  // Isso evita que um atendimento cancelado "anule" um atendimento válido com o mesmo IMEI.
  const activeAtendimentos = allAtendimentos.filter((a) => {
    const status = (a.Status || '').trim().toLowerCase();
    const isCancelled = status.includes('cancel') || status.includes('exclu');
    return !isCancelled;
  });

  console.log(`[${loja.id}] Atendimentos ativos: ${activeAtendimentos.length} (de ${allAtendimentos.length} totais)`);

  // 2. Manter todos os atendimentos ativos do mês.
  // A deduplicação por IMEI no mesmo dia estava removendo vendas válidas,
  // derrubando os totais mensais em casos como o do Ítalo em abril.
  const validAtendimentos = activeAtendimentos;

  const mappedRows = validAtendimentos
    .map((a) => mapAtendimentoToVenda({ ...a, LojaId: loja.id }, mes))
    .filter((row): row is MappedVenda => Boolean(row));

  console.log(`[${loja.id}] Atendimentos do mês ${mes}: ${mappedRows.length}`);
  if (unmappedGroups.size > 0 || unmappedProducts.size > 0) {
    console.log(`[${loja.id}] GRUPOS/PRODUTOS NÃO MAPEADOS (→ GERAL): ${Array.from(unmappedGroups).join(' || ')} | ${Array.from(unmappedProducts).join(' || ')}`);
  }

  // Diagnóstico: amostra das datas que vieram da API
  const sampleDates = allAtendimentos.slice(0, 5).map((a) => a.Data);
  const monthsSeen = new Set<string>();
  for (const a of allAtendimentos) {
    const p = parseDate(a.Data || '');
    if (p) monthsSeen.add(p.month);
  }
  console.log(`[${loja.id}] Meses presentes na API: ${Array.from(monthsSeen).join(', ')} | amostra datas: ${sampleDates.join(' | ')}`);

  if (mappedRows.length === 0) {
    return {
      loja_id: loja.id,
      mes,
      synced: 0,
      vendasDiarias: 0,
      semColaborador: [],
      diagnostico: {
        totalAtendimentosApi: allAtendimentos.length,
        validosAposDedup: validAtendimentos.length,
        mesesNaApi: Array.from(monthsSeen),
        amostraDatas: sampleDates,
      },
    };
  }

  // Agregar por data+vendedor
  const sumByDateVendedor = new Map<string, MappedVenda>();
  for (const row of mappedRows) {
    const key = `${row.data}|${normalize(row.vendedor_nome)}`;
    const existing = sumByDateVendedor.get(key);
    if (!existing) {
      sumByDateVendedor.set(key, { ...row, detalhes: { ...row.detalhes } });
    } else {
      existing.valor_total += row.valor_total;
      existing.valor_bruto += row.valor_bruto;
      for (const [k, v] of Object.entries(row.detalhes)) {
        existing.detalhes[k] = (existing.detalhes[k] || 0) + v;
      }
    }
  }

  // Resolver colaborador_id — combina colaboradores da loja + vínculos cross-loja
  const [{ data: mainColabs }, { data: vinculoColabs }] = await Promise.all([
    internalClient.from('colaboradores').select('id, nome').eq('loja_id', loja.id),
    internalClient
      .from('colaborador_lojas')
      .select('colaborador_id, colaboradores!inner(id, nome)')
      .eq('loja_id', loja.id),
  ]);

  const colaboradorByNome = new Map<string, string>();
  (mainColabs ?? []).forEach((col: { id: string; nome: string }) => {
    colaboradorByNome.set(normalize(col.nome), col.id);
  });
  (vinculoColabs ?? []).forEach((v: any) => {
    const col = v.colaboradores;
    if (col && !colaboradorByNome.has(normalize(col.nome))) {
      colaboradorByNome.set(normalize(col.nome), col.id);
    }
  });

  const resolveColaboradorId = (nome: string): string | null => {
    const norm = normalize(nome);
    const exact = colaboradorByNome.get(norm);
    if (exact) return exact;
    const aliasTarget = NAME_ALIASES[norm];
    if (aliasTarget) {
      const aliased = colaboradorByNome.get(aliasTarget);
      if (aliased) return aliased;
    }
    const matches: string[] = [];
    for (const [colNorm, colId] of colaboradorByNome.entries()) {
      if (colNorm.startsWith(norm + ' ') || colNorm === norm) matches.push(colId);
    }
    if (matches.length === 1) return matches[0];
    return null;
  };

  // Bloqueios
  const { data: bloqueiosData } = await internalClient
    .from('vendedor_bloqueios')
    .select('vendedor_nome')
    .eq('loja_id_bloqueada', loja.id)
    .eq('ativo', true);
  const bloqueados = new Set(
    (bloqueiosData ?? []).map((b: { vendedor_nome: string }) => b.vendedor_nome.toUpperCase().trim()),
  );

  // Payload diárias
  const diariasPayload = Array.from(sumByDateVendedor.values())
    .filter((row) => !bloqueados.has(row.vendedor_nome.toUpperCase().trim()))
    .map((row) => {
      const d = row.detalhes;
      const smartphones = (d['BONIFICADO LC'] || 0) + (d['SUPER BONIFICADO'] || 0) + (d['ANATEL'] || 0);
      const acessorios = (d['ACESSÓRIOS'] || 0) + (d['CASES'] || 0) + (d['PELÍCULA'] || 0);
      const servicos = (d['PROTEÇÃO LÍDER'] || 0) + (d['GARANTIA ESTENDIDA'] || 0) + (d['ASSISTÊNCIA TÉCNICA'] || 0) + (d['SERVIÇOS'] || 0);
      const geral = (d['GERAL'] || 0);
      return {
        loja_id: loja.id,
        mes: row.mes,
        data: row.data,
        vendedor_nome: row.vendedor_nome,
        colaborador_id: resolveColaboradorId(row.vendedor_nome),
        valor_total: row.valor_total,
        valor_bruto: row.valor_bruto,
        smartphones,
        acessorios,
        servicos,
        geral,
        detalhes: row.detalhes,
      };
    });

  if (dryRun) {
    return {
      loja_id: loja.id,
      mes,
      dryRun: true,
      atendimentos: allAtendimentos.length,
      validos: validAtendimentos.length,
      cancelados: allAtendimentos.length - validAtendimentos.length,
      mes_count: mappedRows.length,
      diarias: diariasPayload.length,
      sample: diariasPayload.slice(0, 3),
      gruposNaoMapeados: Array.from(unmappedGroups),
      produtosNaoMapeados: Array.from(unmappedProducts),
      celularesDebug: celularesDebug.slice(0, 200),
    };
  }

  // Upsert vendas_diarias: safe against mid-sync crashes (no DELETE before INSERT)
  if (diariasPayload.length > 0) {
    const { error } = await internalClient
      .from('vendas_diarias')
      .upsert(diariasPayload, { onConflict: 'loja_id,mes,data,vendedor_nome' });
    if (error) throw error;
  }

  // Recalcular vendas mensais a partir de TODAS as diárias do mês no banco
  // (não apenas do batch atual — garante que o total mensal sempre reflita o mês completo)
  const { data: todasDiarias, error: diariasErr } = await internalClient
    .from('vendas_diarias')
    .select('vendedor_nome, colaborador_id, valor_total, geral, detalhes')
    .eq('loja_id', loja.id)
    .eq('mes', mes);
  if (diariasErr) throw diariasErr;

  const vendedorTotais = new Map<string, {
    loja_id: string;
    mes: string;
    vendedor_nome: string;
    colaborador_id: string | null;
    detalhes: Record<string, number>;
    valor_total: number;
    geral: number;
  }>();
  for (const row of todasDiarias || []) {
    const existing = vendedorTotais.get(row.vendedor_nome) || {
      loja_id: loja.id,
      mes,
      vendedor_nome: row.vendedor_nome,
      colaborador_id: row.colaborador_id,
      detalhes: {},
      valor_total: 0,
      geral: 0,
    };
    existing.valor_total += Number(row.valor_total) || 0;
    existing.geral += Number(row.geral) || 0;
    for (const [k, v] of Object.entries(row.detalhes || {})) {
      existing.detalhes[k] = (existing.detalhes[k] || 0) + (Number(v) || 0);
    }
    vendedorTotais.set(row.vendedor_nome, existing);
  }
  const vendasPayload = Array.from(vendedorTotais.values());

  // Upsert vendas mensais: safe replace without destructive delete
  if (vendasPayload.length > 0) {
    const { error } = await internalClient
      .from('vendas')
      .upsert(vendasPayload, { onConflict: 'loja_id,mes,vendedor_nome' });
    if (error) throw error;
  }

  const semColaborador = vendasPayload.filter((v) => !v.colaborador_id).map((v) => v.vendedor_nome);

  // Salvar detalhes dos atendimentos originais para auditoria detalhada
  if (allAtendimentos.length > 0) {
    const { data: tabelaPrecos } = await internalClient.from('tabela_precos').select('*');
    
    const auditRows = allAtendimentos
      .filter(a => parseDate(a.Data)?.month === mes)
      .map(a => {
        let alertasPreco = 0;
        const infoAtendimento = a['Informações do atendimento'] || [];
        
        for (const info of infoAtendimento) {
          const vendas = info.Venda || [];
          for (const venda of vendas) {
            const valor = safeParseNumber(venda['Valor de venda'] || (venda as any).Valor || 0);
            if (checkPriceAlert(venda.Produto, valor, tabelaPrecos || [], loja.id)) {
              alertasPreco++;
            }
          }

        }

        return {
          loja_id: loja.id,
          atendimento_id: a['ID atendimento'],
          vendedor_nome: (a.Vendedor || '').toUpperCase().trim(),
          data_atendimento: parseDate(a.Data)?.isoDate,
          valor_total: safeParseNumber(a['Total bruto']) || infoAtendimento.reduce((sum: number, info: any) => {
            for (const v of [...(info.Venda || []), ...(info.Brinde || [])]) sum += safeParseNumber(v['Valor de venda'] || v.Valor || 0);
            for (const t of info.Troca || []) sum += safeParseNumber(t['Valor de venda'] || t.Valor || 0);
            return sum;
          }, 0),
          detalhes_brutos: infoAtendimento,
          status: a.Status,
          mes: mes,
          alertas_preco: alertasPreco
        };
      });

    if (auditRows.length > 0) {
      await internalClient.from('atendimentos_audit').upsert(auditRows, { onConflict: 'atendimento_id' });
    }
  }


  await internalClient.from('sync_logs').insert({
    loja_id: loja.id,
    mes,
    synced: vendasPayload.length,
    source_rows: mappedRows.length,
    vendedores_atualizados: vendasPayload.map((v) => v.vendedor_nome),
    sem_colaborador: semColaborador,
    success: !wasPartial,
    error_message: wasPartial
      ? 'Rate limit: sync parcial — aguardar próximo ciclo'
      : unmappedProducts.size > 0
        ? `Produtos caindo em GERAL: ${Array.from(unmappedProducts).slice(0, 5).join(', ')}`
        : null,
    api_calls_made: apiCallsMade,
  });

  return {
    loja_id: loja.id,
    mes,
    synced: vendasPayload.length,
    vendasDiarias: diariasPayload.length,
    semColaborador,
  };
};

// ===== Main handler =====

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: Record<string, unknown> = {};
    if (req.method === 'POST') {
      body = await req.json().catch(() => ({}));
    }

    const dryRun = Boolean(body.dryRun);
    const force = Boolean(body.force);
    const fullYear = Boolean(body.fullYear);
    const mes = getRequestedMonth(req, body);
    const onlyLojaId = typeof body.loja_id === 'string' ? body.loja_id : null;
    const onlyLojaIds = Array.isArray(body.loja_ids) ? (body.loja_ids as string[]) : null;

    const internalClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Guard de intervalo mínimo (ignora se for force, dryRun ou loja específica)
    // Usa qualquer sync (success ou parcial) para evitar que falhas parciais bloqueiem retries
    if (!force && !dryRun && !onlyLojaId && !onlyLojaIds) {
      const { data: lastSync } = await internalClient
        .from('sync_logs')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastSync) {
        const minutesAgo = (Date.now() - new Date(lastSync.created_at).getTime()) / 60000;
        if (minutesAgo < MIN_INTERVAL_MINUTES) {
          return new Response(
            JSON.stringify({ skipped: true, reason: `último sync há ${minutesAgo.toFixed(1)} min (mínimo: ${MIN_INTERVAL_MINUTES} min)` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      }
    }

    // Group-specific interval guard (prevents double-firing within same group)
    if (!force && !dryRun && (onlyLojaId || onlyLojaIds)) {
      const filterIds = onlyLojaIds ?? (onlyLojaId ? [onlyLojaId] : []);
      const { data: lastGroupSync } = await internalClient
        .from('sync_logs')
        .select('created_at')
        .in('loja_id', filterIds)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastGroupSync) {
        const minutesAgo = (Date.now() - new Date(lastGroupSync.created_at).getTime()) / 60000;
        if (minutesAgo < MIN_INTERVAL_MINUTES) {
          return new Response(
            JSON.stringify({ skipped: true, reason: `último sync do grupo há ${minutesAgo.toFixed(1)} min (mínimo: ${MIN_INTERVAL_MINUTES} min)` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      }
    }

    // Buscar lojas com credenciais
    let query = internalClient
      .from('lojas')
      .select('id, nome, tenfront_bearer_token, tenfront_consumer_key, tenfront_consumer_secret');
    if (onlyLojaId) query = query.eq('id', onlyLojaId);
    else if (onlyLojaIds && onlyLojaIds.length > 0) query = query.in('id', onlyLojaIds);
    const { data: lojasData, error: lojasError } = await query;
    if (lojasError) throw lojasError;

    const lojas: LojaConfig[] = (lojasData ?? [])
      .filter((l: any) => l.tenfront_bearer_token && l.tenfront_consumer_key && l.tenfront_consumer_secret)
      .map((l: any) => ({
        id: l.id,
        nome: l.nome,
        bearer: l.tenfront_bearer_token,
        consumerKey: l.tenfront_consumer_key,
        consumerSecret: l.tenfront_consumer_secret,
      }));

    if (lojas.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma loja com credenciais Tenfront encontrada.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Identify lojas that already hit their daily rate limit today (BRT day).
    // Tenfront resets at midnight BRT = 03:00 UTC. Use that as the day boundary
    // so skips lift at 03:00 UTC instead of 00:00 UTC (which caused 21h+ blocks).
    const now = new Date();
    const brtMidnight = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 3, 0, 0, 0
    ));
    if (now.getUTCHours() < 3) brtMidnight.setUTCDate(brtMidnight.getUTCDate() - 1);

    const { data: todayFailLogs } = await internalClient
      .from('sync_logs')
      .select('loja_id')
      .gte('created_at', brtMidnight.toISOString())
      .ilike('error_message', '%diário%');
    const dailyLimitedLojas = new Set((todayFailLogs || []).map((r: { loja_id: string }) => r.loja_id));

    // Full-year mode: syncs all months from Jan to (current-1), most recent first.
    // Processes as many months as fit in a 110s budget; resumes next Sunday naturally.
    if (fullYear && !dryRun) {
      const startTime = Date.now();
      const TIME_BUDGET_MS = 110_000;
      const [yearStr] = mes.split('-');
      const currentMonthNum = parseInt(mes.split('-')[1]);
      const allResults: unknown[] = [];
      let processedMonths = 0;

      for (let m = currentMonthNum - 1; m >= 1; m--) {
        if (Date.now() - startTime > TIME_BUDGET_MS) {
          console.log(`[annual] Budget esgotado após ${processedMonths} meses.`);
          break;
        }
        const targetMes = `${yearStr}-${String(m).padStart(2, '0')}`;
        console.log(`[annual] Sync ${targetMes} (${processedMonths + 1}/${currentMonthNum - 1})`);
        for (const loja of lojas) {
          try {
            const result = await syncLoja(internalClient, loja, targetMes, false, true);
            allResults.push({ ...result, mes: targetMes });
          } catch (err) {
            allResults.push({ loja_id: loja.id, mes: targetMes, error: getErrorMessage(err) });
          }
        }
        processedMonths++;
      }

      return new Response(
        JSON.stringify({ success: true, fullYear: true, year: yearStr, processedMonths, results: allResults }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Verificar saldo uma única vez para todas as lojas (compartilham a mesma cota Tenfront)
    let sharedSaldo: number | undefined;
    if (!force && !dryRun && lojas.length > 0) {
      sharedSaldo = await checkSaldo(lojas[0]);
      console.log(`[global] Saldo compartilhado: ${sharedSaldo} req restantes`);
      if (sharedSaldo < MIN_SALDO_THRESHOLD) {
        const results = lojas.map(l => ({ loja_id: l.id, skipped: true, reason: `saldo_insuficiente (${sharedSaldo})` }));
        for (const loja of lojas) {
          await internalClient.from('sync_logs').insert({
            loja_id: loja.id, mes, synced: 0, source_rows: 0,
            vendedores_atualizados: [], sem_colaborador: [],
            success: false,
            error_message: `Saldo diário insuficiente: ${sharedSaldo} req restantes (mínimo ${MIN_SALDO_THRESHOLD}) — aguardando reset às 00:00 BRT`,
            api_calls_made: 1,
          });
        }
        return new Response(
          JSON.stringify({ skipped: true, saldo: sharedSaldo, results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    const results = [];
    for (const loja of lojas) {
      if (!force && dailyLimitedLojas.has(loja.id)) {
        console.log(`[${loja.id}] Rate limit diário já atingido hoje (BRT) — pulando até 03:00 UTC.`);
        results.push({ loja_id: loja.id, skipped: true, reason: 'daily_rate_limit_today' });
        continue;
      }
      try {
        const result = await syncLoja(internalClient, loja, mes, dryRun, force, sharedSaldo);
        results.push(result);
      } catch (err) {
        const msg = getErrorMessage(err);
        console.error(`[${loja.id}] erro:`, msg);
        results.push({ loja_id: loja.id, error: msg });
        if (!dryRun) {
          await internalClient.from('sync_logs').insert({
            loja_id: loja.id,
            mes,
            synced: 0,
            source_rows: 0,
            vendedores_atualizados: [],
            sem_colaborador: [],
            success: false,
            error_message: msg,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, mes, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const msg = getErrorMessage(error);
    console.error('sync-tenfront error:', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

import { TENFRONT_API_URL, TENFRONT_SALDO_URL, MIN_SALDO_THRESHOLD } from './constants.ts';
import { parseDate, parseTenfrontJson } from './utils.ts';
import type { LojaConfig, Atendimento, ApiResponse } from './types.ts';

// ===== Saldo de tokens =====

export const checkSaldo = async (loja: LojaConfig): Promise<number> => {
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

// ===== Fetch all pages from API =====

export const fetchAllAtendimentos = async (loja: LojaConfig, mesAlvo?: string, forceAll = false, lastSyncDate?: string | null, maxPages = 99, lastKnownId?: string | null): Promise<{ records: Atendimento[]; wasPartial: boolean; pagesFetched: number }> => {
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

    // A API Tenfront só retorna registros quando data-inicial é o primeiro dia do mês:
    // qualquer data mais recente devolve zero (confirmado 2026-06-09). Por isso buscamos
    // sempre do dia 1 e cortamos as páginas com ID-stop/early-stop client-side.
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    // Early-stop por data continua como fallback do ID-stop em syncs incrementais.
    if (lastSyncDate) earlyCutoffStr = lastSyncDate;

    dateFilter['data-inicial'] = `${pad(startDate.getUTCDate())}/${pad(startDate.getUTCMonth() + 1)}/${startDate.getUTCFullYear()}`;
    dateFilter['data-final'] = `${pad(today.getUTCDate())}/${pad(today.getUTCMonth() + 1)}/${today.getUTCFullYear()}`;
    console.log(`[${loja.id}] Filtro de data: ${dateFilter['data-inicial']} a ${dateFilter['data-final']} (lastSync: ${lastSyncDate ?? 'nenhum'}, cutoff: ${earlyCutoffStr ?? 'nenhum'})`);
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
  try { firstData = parseTenfrontJson<typeof firstData>(firstText); } catch { throw new Error(`[${loja.id}] resposta inválida: ${firstText.slice(0, 200)}`); }

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

  // ID-stop na página 1: se o último ID já sincronizado aparece aqui, não há páginas novas a buscar.
  // Mais preciso que early-stop por data em lojas de alto volume (ex: Natal).
  if (lastKnownId) {
    const p1Ids = allRecords.map(r => r['ID atendimento']);
    if (p1Ids.includes(lastKnownId)) {
      console.log(`[${loja.id}] ID-stop p1: lastKnownId=${lastKnownId} encontrado. Nenhuma página adicional necessária.`);
      return { records: allRecords, wasPartial, pagesFetched };
    }
  }

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

  const pageLimit = Math.min(totalPages, maxPages);
  if (maxPages < totalPages) {
    console.log(`[${loja.id}] Limite de páginas por ciclo: ${maxPages} de ${totalPages} disponíveis.`);
  }

  // Se o total de páginas for > 1, buscar as demais
  for (let page = 2; page <= pageLimit; page++) {
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

    const data = parseTenfrontJson<ApiResponse>(await response.text());
    const records = data.Response || [];
    console.log(`[${loja.id}] Tenfront: Página ${page} carregada com ${records.length} registros`);

    allRecords.push(...records);

    // Aguardar 150ms entre as páginas para evitar burst no rate limit por minuto
    await new Promise(resolve => setTimeout(resolve, 150));

    // ID-stop: encontrou o último ID já sincronizado — tudo a partir daqui já está no banco.
    if (lastKnownId) {
      const pageIds = records.map(r => r['ID atendimento']);
      if (pageIds.includes(lastKnownId)) {
        console.log(`[${loja.id}] ID-stop p${page}: lastKnownId=${lastKnownId} encontrado. Parando.`);
        break;
      }
    }

    // Early-stop por data: fallback para quando não há lastKnownId (primeiro sync do mês).
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

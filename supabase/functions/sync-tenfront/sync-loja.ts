import { MIN_SALDO_THRESHOLD, NAME_ALIASES } from './constants.ts';
import { safeParseNumber, normalize, parseDate } from './utils.ts';
import { unmappedGroups, unmappedProducts, celularesDebug } from './categorization.ts';
import { checkPriceAlert } from './price-audit.ts';
import { checkSaldo, fetchAllAtendimentos } from './tenfront-api.ts';
import { getLastSyncDate, getLastSyncedAtendimentoId } from './db.ts';
import { mapAtendimentoToVenda } from './map-venda.ts';
import type { LojaConfig, MappedVenda } from './types.ts';

// ===== Sincronizar uma loja =====

// deno-lint-ignore no-explicit-any
export const syncLoja = async (
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

  const [lastSyncDate, lastKnownId] = forceFullFetch
    ? [null, null]
    : await Promise.all([
        getLastSyncDate(internalClient, loja.id, mes),
        getLastSyncedAtendimentoId(internalClient, loja.id, mes),
      ]);

  console.log(`[${loja.id}] Última data: ${lastSyncDate ?? 'nenhuma'} | Último ID: ${lastKnownId ?? 'nenhum'}`);
  const { records: allAtendimentos, wasPartial, pagesFetched } = await fetchAllAtendimentos(loja, mes, false, lastSyncDate, 99, lastKnownId);
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

  // Gravar atendimentos_audit ANTES de agregar — eles precisam estar no banco
  // para que o recálculo das diárias parta do conjunto completo do mês.
  if (allAtendimentos.length > 0) {
    const { data: tabelaPrecos } = await internalClient.from('tabela_precos').select('*');

    const auditRows = allAtendimentos
      .filter((a) => parseDate(a.Data)?.month === mes)
      .map((a) => {
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
          pagamento: (a as any).Pagamento || [],
          status: a.Status,
          mes,
          alertas_preco: alertasPreco,
        };
      });

    if (auditRows.length > 0) {
      await internalClient.from('atendimentos_audit').upsert(auditRows, { onConflict: 'atendimento_id' });
    }
  }

  // Recalcular vendas_diarias a partir de TODOS os atendimentos do mês no audit,
  // não só do ciclo atual — garante que um sync incremental não apague dados anteriores.
  const { data: auditDoMes, error: auditErr } = await internalClient
    .from('atendimentos_audit')
    .select('atendimento_id, vendedor_nome, data_atendimento, valor_total, detalhes_brutos, pagamento, status')
    .eq('loja_id', loja.id)
    .eq('mes', mes);
  if (auditErr) throw auditErr;

  // Reconstruir objeto Atendimento a partir de cada linha do audit e passar por mapAtendimentoToVenda.
  // data_atendimento está em ISO "YYYY-MM-DD" com o dia já ajustado pelo corte das 4h.
  // Usamos "DD/MM/YYYY 12:00" para que parseDate produza o mesmo dia (hora 12 nunca dispara o corte).
  type AuditRow = {
    atendimento_id: string;
    vendedor_nome: string;
    data_atendimento: string;
    valor_total: number;
    // deno-lint-ignore no-explicit-any
    detalhes_brutos: any[];
    // deno-lint-ignore no-explicit-any
    pagamento: any[];
    status: string;
  };

  const auditRows2: AuditRow[] = auditDoMes ?? [];
  const mappedOrNull: Array<MappedVenda | null> = auditRows2.map((row: AuditRow): MappedVenda | null => {
    const [y, m2, d] = row.data_atendimento.split('-');
    const dataFormatada = `${d}/${m2}/${y} 12:00`;
    const atendimentoReconstruido = {
      Data: dataFormatada,
      'ID atendimento': row.atendimento_id,
      Vendedor: row.vendedor_nome,
      Status: row.status,
      'Total bruto': row.valor_total,
      'Informações do atendimento': row.detalhes_brutos ?? [],
      Pagamento: row.pagamento ?? [],
      LojaId: loja.id,
    };
    return mapAtendimentoToVenda(atendimentoReconstruido as any, mes);
  });
  const mappedFromAudit: MappedVenda[] = mappedOrNull.filter(
    (row: MappedVenda | null): row is MappedVenda => row !== null,
  );

  // Agregar por data+vendedor a partir do audit completo do mês
  const sumByDateVendedor = new Map<string, MappedVenda>();
  for (const row of mappedFromAudit) {
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
      // mes_count agora reflete o total do mês no audit (não só o ciclo atual)
      mes_count: mappedFromAudit.length,
      ciclo_count: mappedRows.length,
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

  await internalClient.from('sync_logs').insert({
    loja_id: loja.id,
    mes,
    synced: vendasPayload.length,
    // source_rows = total do mês no audit (base do recálculo); ciclo_rows = só o fetch atual
    source_rows: mappedFromAudit.length,
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

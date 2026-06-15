/**
 * Sync Tenfront → Supabase
 *
 * Dois modos (igual padrão Beto Motobike):
 *   --modo full        Mês inteiro. Delete + insert. Roda 1x/dia (00:00).
 *   --modo incremental Ontem + hoje. Upsert. Roda a cada ~25min. (default)
 *
 * Outros flags:
 *   --mes 2026-05      Mês alvo (default: mês atual)
 *   --dry-run          Mostra o que seria feito, não grava
 *   --force            Ignora lockfile
 */

import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dir   = dirname(fileURLToPath(import.meta.url));
const LOCK    = join(__dir, '.sync-full.lock');
const API_URL  = 'https://api.tenfront.com.br/v1/listar-atendimentos';
const SALDO_URL = 'https://api.tenfront.com.br/v1/saldo-token';
const MIN_SALDO = 10;

// ── Config ───────────────────────────────────────────────────────────────────

function loadEnv(file) {
  try {
    return Object.fromEntries(
      readFileSync(file, 'utf8').split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#'))
        .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim().replace(/^["']|["']$/g, '')]; })
    );
  } catch { return {}; }
}

const env = loadEnv(join(__dir, '.env'));
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados no .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const lojas = JSON.parse(readFileSync(join(__dir, 'lojas.json'), 'utf8'));
const args  = process.argv.slice(2);

const now  = new Date();
const MES  = (() => { const i = args.indexOf('--mes'); return i !== -1 ? args[i+1] : `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`; })();
const MODO    = args.includes('--modo') ? args[args.indexOf('--modo')+1] : (args.includes('full') ? 'full' : 'incremental');
const DRY_RUN = args.includes('--dry-run');
const FORCE   = args.includes('--force');

// ── Lockfile ─────────────────────────────────────────────────────────────────

function acquireLock() {
  if (existsSync(LOCK)) {
    const age = (Date.now() - Number(readFileSync(LOCK, 'utf8'))) / 1000 / 60;
    if (age < 30) {
      console.log(`🔒 Full sync em andamento (há ${age.toFixed(1)} min). Incremental abortado.`);
      process.exit(0);
    }
    console.log(`⚠️  Lock órfão (${age.toFixed(0)} min). Limpando.`);
  }
  writeFileSync(LOCK, String(Date.now()));
}

function releaseLock() {
  try { unlinkSync(LOCK); } catch {}
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const pad = n => String(n).padStart(2, '0');
const fmt = n => `R$ ${n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
const normalize = v => (v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const safeNum = val => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') { const c = val.replace('R$','').replace(/\./g,'').replace(',','.').trim(); const p = parseFloat(c); return isNaN(p) ? 0 : p; }
  return 0;
};

const parseDate = str => {
  const m = (str||'').match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return null;
  let dt = new Date(Date.UTC(+m[3], +m[2]-1, +m[1], +(m[4]||12), +(m[5]||0)));
  if (+(m[4]||12) < 4) dt = new Date(dt.getTime() - 86400000);
  const iso = `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth()+1)}-${pad(dt.getUTCDate())}`;
  return { isoDate: iso, month: iso.slice(0,7) };
};

const VENDEDOR_NOME_OVERRIDES = { lucas:'LUCAS', celio:'CÉLIO', igor:'IGOR', joao:'JOÃO' };

const classifySmartphone = (produto, valor=0) => {
  const l = (produto||'').toLowerCase();
  if (l.includes('super bonificado')||l.includes('superbonificado')) return 'SUPER BONIFICADO';
  if (l.includes('infinix')||l.includes('infnix')) return valor===900 ? 'BONIFICADO LC' : 'SUPER BONIFICADO';
  if (l.includes('bonificado lc')||l.includes('bonificado')) return 'BONIFICADO LC';
  if (l.includes('redmi pad')) return 'BONIFICADO LC';
  if ((l.includes('iphone')||l.includes('galaxy')||l.includes('motorola')||l.includes('xiaomi')||l.includes('realme'))&&valor>=1000) return 'BONIFICADO LC';
  if (valor>=2500) return 'SUPER BONIFICADO';
  if (valor>=900) return 'BONIFICADO LC';
  return 'ANATEL';
};

const classifyServico = p => {
  const l=(p||'').toLowerCase();
  if (l.includes('proteç')||l.includes('protec')||l.includes('blindagem')) return 'PROTEÇÃO LÍDER';
  if (l.includes('garantia')) return 'GARANTIA ESTENDIDA';
  if (l.includes('manuten')||l.includes('assist')) return 'ASSISTÊNCIA TÉCNICA';
  return 'SERVIÇOS';
};

const mapGrupo = (grupo, produto, tipo='', subtipo='', valor=0) => {
  const n = t => (t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
  const gN=n(grupo), pN=n(produto), sN=n(subtipo), tN=n(tipo);
  if (pN.includes('super bonificado')||pN.includes('superbonificado')) return 'SUPER BONIFICADO';
  if (pN.includes('bonificado lc')||pN.includes('bonificadolc')) return 'BONIFICADO LC';
  if (pN.includes('redmi pad')) return 'BONIFICADO LC';
  const isGeral = pN.includes('(geral)') || (pN.includes('geral')&&(pN.includes('lacrado')||pN.includes('jbl')||gN==='geral'||gN==='vendas gerais'));
  if (isGeral) return 'GERAL';
  if (tN.includes('celular')||tN.includes('smartphone')||tN.includes('iphone')||tN.includes('dispositivo')||gN.includes('celulares')) return classifySmartphone(produto, valor);
  if (pN.includes('protec')||pN.includes('blindagem')||gN.includes('protecao')||sN.includes('protecao')) return 'PROTEÇÃO LÍDER';
  if (pN.includes('garantia')||gN.includes('garantia')||sN.includes('garantia')) return 'GARANTIA ESTENDIDA';
  if (gN.includes('pelicula')||sN.includes('pelicula')||pN.includes('pelicula')||pN.includes('hidrogel')||pN.includes('vidro')) return 'PELÍCULA';
  if (gN.includes('case')||gN.includes('capinha')||gN.includes('capa')||sN.includes('capa')||pN.includes('capa')) return 'CASES';
  if (tN.includes('servico')||tN.includes('assistencia')||tN.includes('manutencao')||gN.includes('servico')||gN.includes('manutencao')) return classifyServico(produto);
  if (tN.includes('acessorio')||gN.includes('acessorio')||sN.includes('acessorio')) return 'ACESSÓRIOS';
  if (gN.includes('geral')||gN.includes('vendas gerais')||gN.includes('outros')) return 'GERAL';
  if (valor>0&&valor<500) return 'ACESSÓRIOS';
  return 'GERAL';
};

// ── Tenfront API ─────────────────────────────────────────────────────────────

async function checkSaldo(loja) {
  try {
    const url = `${SALDO_URL}?Consumer-key=${encodeURIComponent(loja.consumerKey)}&Consumer-secret=${encodeURIComponent(loja.consumerSecret)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${loja.bearer}` } });
    if (!r.ok) return 999;
    const d = await r.json();
    const raw = d?.response?.['Saldo diário restante'] ?? d?.response?.saldo ?? '';
    const n = typeof raw === 'string' ? parseInt(raw) : Number(raw??999);
    return isNaN(n) ? 999 : n;
  } catch { return 999; }
}

async function getLastSyncDate(lojaId) {
  const { data } = await supabase
    .from('vendas_diarias')
    .select('data')
    .eq('loja_id', lojaId)
    .eq('mes', MES)
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.data ?? null;
}

async function fetchAtendimentos(loja, dataInicial, dataFinal, lastSyncDate = null) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${loja.bearer}`,
    'Consumer-key': loja.consumerKey,
    'Consumer-secret': loja.consumerSecret,
  };
  const dateFilter = { 'data-inicial': dataInicial, 'data-final': dataFinal };
  let reqCount = 0;
  const all = [];

  const fetchPage = async page => {
    const r = await fetch(API_URL, { method:'POST', headers, body: JSON.stringify({ page: String(page), ...dateFilter }) });
    reqCount++;
    const text = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0,200)}`);
    return JSON.parse(text);
  };

  const p1 = await fetchPage(1);
  if (!Array.isArray(p1.Response)) throw new Error(`Resposta inválida: ${JSON.stringify(p1).slice(0,200)}`);
  const totalPages = Number(p1['Total pages']) || 1;
  console.log(`  📄 Página 1/${totalPages} → ${p1.Response.length} registros`);

  if (lastSyncDate && MODO === 'incremental') {
    const p1dates = p1.Response.map(r => parseDate(r.Data)?.isoDate).filter(Boolean).sort();
    const newest = p1dates[p1dates.length - 1];
    const oldest = p1dates[0];

    // Nenhuma novidade: a mais recente já está no banco
    if (newest && newest <= lastSyncDate) {
      console.log(`  ⚡ Sem novidades (newest: ${newest} ≤ lastSync: ${lastSyncDate}) — 1 req.`);
      return { records: [], reqCount, skipped: true };
    }

    // Registros novos cabem na página 1: a mais antiga da página já é conhecida
    // → não precisa buscar mais páginas
    if (oldest && oldest <= lastSyncDate) {
      const novos = p1.Response.filter(r => {
        const d = parseDate(r.Data);
        return d && d.isoDate > lastSyncDate;
      });
      console.log(`  ⚡ Novidades na pág.1 (${novos.length} registros novos) — 1 req.`);
      return { records: novos, reqCount };
    }
  }

  all.push(...p1.Response);

  for (let p = 2; p <= totalPages; p++) {
    await new Promise(r => setTimeout(r, 400));
    const d = await fetchPage(p);
    const recs = d.Response || [];
    console.log(`  📄 Página ${p}/${totalPages} → ${recs.length} registros`);

    if (lastSyncDate && MODO === 'incremental') {
      const dates = recs.map(r => parseDate(r.Data)?.isoDate).filter(Boolean).sort();
      const oldest = dates[0];
      if (oldest && oldest <= lastSyncDate) {
        // Pega só os registros novos desta página e para
        const novos = recs.filter(r => { const d = parseDate(r.Data); return d && d.isoDate > lastSyncDate; });
        all.push(...novos);
        console.log(`  ⏹  Limite atingido — ${novos.length} registros novos desta página.`);
        break;
      }
    }

    all.push(...recs);

    // Para se chegou em datas anteriores ao mês (full mode)
    const dates = recs.map(r => parseDate(r.Data)).filter(Boolean).map(d => d.isoDate).sort();
    if (dates.length) {
      const [year, month] = MES.split('-').map(Number);
      const cutoff = new Date(Date.UTC(year, month-1, 1));
      cutoff.setUTCDate(cutoff.getUTCDate() - 2);
      if (dates[0] < cutoff.toISOString().slice(0,10)) { console.log(`  ⏹  Data anterior ao mês — parando.`); break; }
    }
  }

  return { records: all, reqCount };
}

// ── Map → vendas diárias ─────────────────────────────────────────────────────

function mapToVendasDiarias(records, lojaId) {
  const active = records.filter(a => {
    const s = (a.Status||'').toLowerCase();
    return !s.includes('cancel') && !s.includes('exclu');
  });

  const byKey = new Map();
  for (const a of active) {
    const parsed = parseDate(a.Data);
    if (!parsed || parsed.month !== MES) continue;
    const vendedorRaw = (a.Vendedor||'').trim();
    if (!vendedorRaw) continue;
    const vendedorNome = (VENDEDOR_NOME_OVERRIDES[normalize(vendedorRaw)] || vendedorRaw).toUpperCase().trim();

    const detalhes = {};
    let valorTotal=0, qtdSm=0, qtdSvc=0;

    for (const info of a['Informações do atendimento']||[]) {
      for (const item of [...(info.Venda||[]), ...(info.Brinde||[])]) {
        const val = safeNum(item['Valor de venda']||item.Valor||0);
        if (val <= 0) continue;
        const cat = mapGrupo(item.Grupo||'', item.Produto||'', item['Tipo produto']||'', item.Subtipo||'', val);
        detalhes[cat] = (detalhes[cat]||0) + val;
        valorTotal += val;
        if (['BONIFICADO LC','SUPER BONIFICADO','ANATEL'].includes(cat)) qtdSm += (Number(item.Quantidade)||1);
        else if (['PROTEÇÃO LÍDER','GARANTIA ESTENDIDA'].includes(cat)) qtdSvc += (Number(item.Quantidade)||1);
      }
      for (const t of info.Troca||[]) {
        const val = safeNum(t['Valor de venda']||t.Valor||0);
        if (val === 0) continue;
        const cat = mapGrupo(t.Grupo||'', t.Produto||'', t['Tipo produto']||'', t.Subtipo||'', val);
        detalhes[cat] = (detalhes[cat]||0) + val;
        valorTotal += val;
      }
    }

    if (qtdSm > 0) detalhes['__qtd_smartphones'] = qtdSm;
    if (qtdSvc > 0) detalhes['__qtd_servicos'] = qtdSvc;
    if (valorTotal <= 0 && qtdSm === 0) continue;

    const key = `${parsed.isoDate}|${normalize(vendedorNome)}`;
    const ex = byKey.get(key);
    if (!ex) {
      byKey.set(key, { loja_id: lojaId, mes: MES, data: parsed.isoDate, vendedor_nome: vendedorNome, valor_total: valorTotal, detalhes });
    } else {
      ex.valor_total += valorTotal;
      for (const [k,v] of Object.entries(detalhes)) ex.detalhes[k] = (ex.detalhes[k]||0) + v;
    }
  }

  return Array.from(byKey.values()).map(r => {
    const d = r.detalhes;
    return { ...r,
      smartphones: (d['BONIFICADO LC']||0)+(d['SUPER BONIFICADO']||0)+(d['ANATEL']||0),
      acessorios:  (d['ACESSÓRIOS']||0)+(d['CASES']||0)+(d['PELÍCULA']||0),
      servicos:    (d['PROTEÇÃO LÍDER']||0)+(d['GARANTIA ESTENDIDA']||0)+(d['ASSISTÊNCIA TÉCNICA']||0)+(d['SERVIÇOS']||0),
      geral:       d['GERAL']||0,
    };
  });
}

// ── Recalcular vendas mensais ─────────────────────────────────────────────────

async function recalcularMensal(lojaId, vendedoresAfetados = null) {
  // Busca todas as diárias do mês (ou só dos vendedores afetados)
  let query = supabase.from('vendas_diarias').select('*').eq('loja_id', lojaId).eq('mes', MES);
  if (vendedoresAfetados) query = query.in('vendedor_nome', vendedoresAfetados);
  const { data: diarias, error } = await query;
  if (error) throw new Error(`fetch diarias: ${error.message}`);

  // Se recalculando só alguns vendedores, busca os demais do mensal existente
  const mensalMap = new Map();
  if (vendedoresAfetados) {
    const { data: existing } = await supabase.from('vendas').select('*').eq('loja_id', lojaId).eq('mes', MES);
    for (const v of existing||[]) {
      if (!vendedoresAfetados.includes(v.vendedor_nome)) mensalMap.set(v.vendedor_nome, v);
    }
  }

  for (const r of diarias||[]) {
    const ex = mensalMap.get(r.vendedor_nome) || { loja_id: lojaId, mes: MES, vendedor_nome: r.vendedor_nome, colaborador_id: null, valor_total: 0, geral: 0, detalhes: {} };
    // Se é recalculo total do vendedor, zera antes
    if (!mensalMap.has(r.vendedor_nome)) {
      ex.valor_total = 0; ex.geral = 0; ex.detalhes = {};
    }
    ex.valor_total += r.valor_total;
    ex.geral += r.geral||0;
    for (const [k,v] of Object.entries(r.detalhes||{})) ex.detalhes[k] = (ex.detalhes[k]||0) + v;
    mensalMap.set(r.vendedor_nome, ex);
  }

  const mensal = Array.from(mensalMap.values());

  if (vendedoresAfetados) {
    // Upsert só os afetados
    const afetados = mensal.filter(v => vendedoresAfetados.includes(v.vendedor_nome));
    if (afetados.length > 0) {
      const { error } = await supabase.from('vendas').upsert(afetados, { onConflict: 'loja_id,mes,vendedor_nome' });
      if (error) throw new Error(`upsert vendas: ${error.message}`);
    }
  } else {
    await supabase.from('vendas').delete().eq('loja_id', lojaId).eq('mes', MES);
    if (mensal.length > 0) {
      const { error } = await supabase.from('vendas').insert(mensal);
      if (error) throw new Error(`insert vendas: ${error.message}`);
    }
  }

  return mensal.length;
}

// ── Sync loja ────────────────────────────────────────────────────────────────

async function syncLoja(loja) {
  const saldo = await checkSaldo(loja);
  console.log(`  Saldo: ${saldo === 999 ? '(N/D)' : saldo + ' req restantes'}`);
  if (saldo < MIN_SALDO) { console.log(`  ⛔ Saldo insuficiente. Pulando.`); return; }

  // Janela de datas por modo
  let dataInicial, dataFinal;
  const hoje = new Date();
  const ontem = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() - 1));

  if (MODO === 'full') {
    const [year, month] = MES.split('-').map(Number);
    dataInicial = `01/${pad(month)}/${year}`;
    dataFinal   = `${pad(hoje.getDate())}/${pad(hoje.getMonth()+1)}/${hoje.getFullYear()}`;
  } else {
    // incremental: ontem + hoje (garante vendas da madrugada e do dia atual)
    dataInicial = `${pad(ontem.getUTCDate())}/${pad(ontem.getUTCMonth()+1)}/${ontem.getUTCFullYear()}`;
    dataFinal   = `${pad(hoje.getDate())}/${pad(hoje.getMonth()+1)}/${hoje.getFullYear()}`;
  }

  console.log(`  📅 ${MODO === 'full' ? 'Mês inteiro' : 'Ontem + hoje'}: ${dataInicial} → ${dataFinal}`);

  // Incremental: busca última data no banco para smart stop
  const lastSyncDate = MODO === 'incremental' ? await getLastSyncDate(loja.id) : null;
  if (lastSyncDate) console.log(`  🕓 Último registro no banco: ${lastSyncDate}`);

  let records, reqCount, skipped;
  try {
    ({ records, reqCount, skipped } = await fetchAtendimentos(loja, dataInicial, dataFinal, lastSyncDate));
  } catch (err) {
    console.error(`  ❌ API: ${err.message}`); return;
  }

  if (skipped) { console.log(`  ✅ Nenhuma novidade — ${reqCount} req consumida.`); return; }
  console.log(`  ✅ ${records.length} atendimentos | ${reqCount} req`);

  const diarias = mapToVendasDiarias(records, loja.id);

  // Resumo
  const mensalMap = new Map();
  for (const r of diarias) {
    const ex = mensalMap.get(r.vendedor_nome) || { nome: r.vendedor_nome, total: 0, sm: 0, svc: 0 };
    ex.total += r.valor_total; ex.sm += r.smartphones; ex.svc += r.servicos;
    mensalMap.set(r.vendedor_nome, ex);
  }
  const ranking = Array.from(mensalMap.values()).sort((a,b) => b.total-a.total);
  console.log(`\n  ${'VENDEDOR'.padEnd(22)} ${'TOTAL'.padStart(14)}  ${'SMARTPHONES'.padStart(14)}  ${'SERVIÇOS'.padStart(12)}`);
  console.log(`  ${'─'.repeat(68)}`);
  for (const v of ranking) console.log(`  ${v.nome.padEnd(22)} ${fmt(v.total).padStart(14)}  ${fmt(v.sm).padStart(14)}  ${fmt(v.svc).padStart(12)}`);
  const totalG = ranking.reduce((s,v)=>s+v.total,0);
  console.log(`  ${'─'.repeat(68)}`);
  console.log(`  ${'TOTAL'.padEnd(22)} ${fmt(totalG).padStart(14)}`);

  if (DRY_RUN) { console.log(`\n  🔍 Dry-run — ${diarias.length} linhas NÃO gravadas.`); return; }

  // Gravar
  await supabase.from('lojas').upsert({ id: loja.id, nome: loja.id.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) }, { onConflict: 'id' });

  let ndDiarias = 0, ndMensal = 0, vendedoresAfetados = [];

  if (MODO === 'full') {
    const { error: delErr } = await supabase.from('vendas_diarias').delete().eq('loja_id', loja.id).eq('mes', MES);
    if (delErr) { console.error(`  ❌ delete: ${delErr.message}`); return; }
    if (diarias.length > 0) {
      const { error } = await supabase.from('vendas_diarias').insert(diarias);
      if (error) { console.error(`  ❌ insert diarias: ${error.message}`); return; }
    }
    ndMensal = await recalcularMensal(loja.id, null);
    ndDiarias = diarias.length;
    vendedoresAfetados = ranking.map(v => v.nome);
    console.log(`\n  💾 Full: ${ndDiarias} vendas_diarias + ${ndMensal} mensais`);
  } else {
    if (diarias.length > 0) {
      const { error } = await supabase.from('vendas_diarias').upsert(diarias, { onConflict: 'loja_id,mes,data,vendedor_nome' });
      if (error) { console.error(`  ❌ upsert diarias: ${error.message}`); return; }
    }
    vendedoresAfetados = [...new Set(diarias.map(r => r.vendedor_nome))];
    ndMensal = await recalcularMensal(loja.id, vendedoresAfetados);
    ndDiarias = diarias.length;
    console.log(`\n  💾 Incremental: ${ndDiarias} upserts | ${vendedoresAfetados.length} vendedores recalculados`);
  }

  // Registra no sync_logs para o sino do app disparar
  if (!DRY_RUN && ndDiarias > 0) {
    await supabase.from('sync_logs').insert({
      loja_id: loja.id,
      mes: MES,
      synced: ndMensal,
      source_rows: ndDiarias,
      vendedores_atualizados: vendedoresAfetados,
      sem_colaborador: [],
      success: true,
      error_message: null,
    });
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

// Incremental não roda se full está em andamento
if (MODO === 'incremental' && !FORCE && existsSync(LOCK)) {
  const age = (Date.now() - Number(readFileSync(LOCK,'utf8'))) / 1000 / 60;
  if (age < 30) { console.log(`🔒 Full sync em andamento (há ${age.toFixed(1)} min). Incremental pulado.`); process.exit(0); }
  unlinkSync(LOCK);
}

if (MODO === 'full') acquireLock();
process.on('exit', () => { if (MODO === 'full') releaseLock(); });
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

console.log(`\n${'═'.repeat(60)}`);
console.log(`  SYNC [${MODO.toUpperCase()}] → Supabase  |  mês ${MES}${DRY_RUN?' [DRY-RUN]':''}`);
console.log(`  Lojas: ${lojas.map(l=>l.id).join(', ')}`);
console.log(`${'═'.repeat(60)}`);

for (const loja of lojas) {
  console.log(`\n── ${loja.id.toUpperCase()} ${'─'.repeat(40-loja.id.length)}`);
  await syncLoja(loja);
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`  https://lider-celulares-phi.vercel.app`);
console.log(`${'═'.repeat(60)}\n`);

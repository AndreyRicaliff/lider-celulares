/**
 * Teste local completo da lógica sync-tenfront — sem Supabase, sem Deno.
 * Chama a API Tenfront real e mostra exatamente o que seria gravado no banco.
 *
 * Uso:
 *   node test-local.mjs
 *   node test-local.mjs --mes 2026-05
 *   node test-local.mjs --sem-filtro     (compara comportamento antigo vs novo)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Credenciais ──────────────────────────────────────────────────────────────

function loadEnv(file) {
  try {
    return Object.fromEntries(
      readFileSync(file, 'utf8').split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#'))
        .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim().replace(/^["']|["']$/g, '')]; })
    );
  } catch { return {}; }
}

const env = { ...loadEnv(join(__dir, '.env.tenfront')), ...process.env };
const args = process.argv.slice(2);

// Suporte a múltiplas lojas via lojas.json ou credencial única via .env.tenfront
let LOJAS_CONFIG = [];

try {
  const raw = readFileSync(join(__dir, 'lojas.json'), 'utf8');
  LOJAS_CONFIG = JSON.parse(raw);
  console.log(`📋 Usando lojas.json — ${LOJAS_CONFIG.length} loja(s) encontrada(s)`);
} catch {
  // Fallback: credencial única do .env.tenfront, testa todas as lojas com ela
  const BEARER = (env.TENFRONT_BEARER || '').replace(/^Bearer\s+/i, '');
  const KEY    = env.TENFRONT_CONSUMER_KEY    || '';
  const SECRET = env.TENFRONT_CONSUMER_SECRET || '';

  if (!BEARER || !KEY || !SECRET) {
    console.error('❌  Crie .env.tenfront com TENFRONT_BEARER, TENFRONT_CONSUMER_KEY, TENFRONT_CONSUMER_SECRET');
    console.error('    Ou crie lojas.json para múltiplas credenciais (veja lojas.example.json)');
    process.exit(1);
  }

  // Se credencial única, replica para todas as lojas conhecidas
  const ids = ['campina-grande', 'caruaru', 'monteiro', 'natal', 'soledade'];
  const lojaIdx = args.indexOf('--loja');
  const soLoja  = lojaIdx !== -1 ? args[lojaIdx + 1] : null;
  const filtradas = soLoja ? ids.filter(id => id === soLoja) : ids;

  LOJAS_CONFIG = filtradas.map(id => ({ id, bearer: BEARER, consumerKey: KEY, consumerSecret: SECRET }));
  console.log(`📋 Credencial única — testando: ${filtradas.join(', ')}`);
}

const mesIdx = args.indexOf('--mes');
const now = new Date();
const MES = mesIdx !== -1 ? args[mesIdx + 1]
  : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const SEM_FILTRO = args.includes('--sem-filtro');

const API_URL   = 'https://api.tenfront.com.br/v1/listar-atendimentos';
const SALDO_URL = 'https://api.tenfront.com.br/v1/saldo-token';

// reqHeaders é montado por loja dentro das funções

// ── Lógica portada da edge function ─────────────────────────────────────────

const VENDEDOR_NOME_OVERRIDES = { lucas: 'LUCAS', celio: 'CÉLIO', igor: 'IGOR', joao: 'JOÃO' };
const NAME_ALIASES = { lucas: 'lucas ferreira', igor: 'eudivan' };

const normalize = v => v.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

const safeNum = val => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const c = val.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
    const p = parseFloat(c);
    return isNaN(p) ? 0 : p;
  }
  return 0;
};

const classifySmartphone = (produto, valor = 0) => {
  const l = (produto || '').toLowerCase().trim();
  if (l.includes('super bonificado') || l.includes('superbonificado')) return 'SUPER BONIFICADO';
  if (l.includes('infinix') || l.includes('infnix')) return valor === 900 ? 'BONIFICADO LC' : 'SUPER BONIFICADO';
  if (l.includes('bonificado lc') || l.includes('bonificado')) return 'BONIFICADO LC';
  if (l.includes('redmi pad')) return 'BONIFICADO LC';
  if ((l.includes('iphone') || l.includes('galaxy') || l.includes('motorola') || l.includes('xiaomi') || l.includes('realme')) && valor >= 1000) return 'BONIFICADO LC';
  if (valor >= 2500) return 'SUPER BONIFICADO';
  if (valor >= 900) return 'BONIFICADO LC';
  return 'ANATEL';
};

const classifyServico = produto => {
  const p = (produto || '').toLowerCase();
  if (p.includes('proteç') || p.includes('protec') || p.includes('blindagem')) return 'PROTEÇÃO LÍDER';
  if (p.includes('garantia')) return 'GARANTIA ESTENDIDA';
  if (p.includes('manuten') || p.includes('assist') || p.includes('bat iphone') || p.includes('telas diversas')) return 'ASSISTÊNCIA TÉCNICA';
  return 'SERVIÇOS';
};

const mapGrupo = (grupo, produto, tipo = '', subtipo = '', valor = 0) => {
  const norm = t => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const gN = norm(grupo); const pN = norm(produto); const sN = norm(subtipo); const tN = norm(tipo);
  if (pN.includes('super bonificado') || pN.includes('superbonificado')) return 'SUPER BONIFICADO';
  if (pN.includes('bonificado lc') || pN.includes('bonificadolc')) return 'BONIFICADO LC';
  if (pN.includes('redmi pad')) return 'BONIFICADO LC';
  const isGeral = pN.includes('(geral)') || (pN.includes('geral') && (pN.includes('lacrado') || pN.includes('jbl') || gN === 'geral' || gN === 'vendas gerais'));
  if (isGeral) return 'GERAL';
  if (tN.includes('celular') || tN.includes('smartphone') || tN.includes('iphone') || tN.includes('dispositivo') || gN.includes('celulares')) return classifySmartphone(produto, valor);
  if (pN.includes('protec') || pN.includes('proteca') || pN.includes('blindagem') || gN.includes('protecao') || sN.includes('protecao')) return 'PROTEÇÃO LÍDER';
  if (pN.includes('garantia') || gN.includes('garantia') || sN.includes('garantia')) return 'GARANTIA ESTENDIDA';
  if (gN.includes('pelicula') || sN.includes('pelicula') || pN.includes('pelicula') || pN.includes('hidrogel') || pN.includes('tpu') || pN.includes('vidro')) return 'PELÍCULA';
  if (gN.includes('case') || gN.includes('capinha') || gN.includes('capa') || sN.includes('capa') || pN.includes('capa')) return 'CASES';
  if (tN.includes('servico') || tN.includes('assistencia') || tN.includes('manutencao') || gN.includes('servico') || gN.includes('manutencao')) return classifyServico(produto);
  if (tN.includes('acessorio') || gN.includes('acessorio') || sN.includes('acessorio')) return 'ACESSÓRIOS';
  if (gN.includes('geral') || gN.includes('vendas gerais') || gN.includes('outros')) return 'GERAL';
  if (valor > 0 && valor < 500) return 'ACESSÓRIOS';
  return 'GERAL';
};

const parseDate = dateStr => {
  const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [, d, mo, y, h = '12', mi = '0'] = m;
  let dt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
  if (+h < 4) dt = new Date(dt.getTime() - 86400000);
  const pad = n => String(n).padStart(2, '0');
  const isoDate = `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
  return { isoDate, month: isoDate.slice(0, 7) };
};

// ── Fetch API ────────────────────────────────────────────────────────────────

function makeHeaders(loja) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${loja.bearer}`,
    'Consumer-key': loja.consumerKey,
    'Consumer-secret': loja.consumerSecret,
  };
}

async function fetchSaldo(loja) {
  try {
    const url = `${SALDO_URL}?Consumer-key=${encodeURIComponent(loja.consumerKey)}&Consumer-secret=${encodeURIComponent(loja.consumerSecret)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${loja.bearer}` },
    });
    if (!res.ok) return null;
    const d = await res.json();
    const raw = d?.response?.['Saldo diário restante'] ?? d?.response?.saldo ?? null;
    return typeof raw === 'string' ? parseInt(raw) : raw;
  } catch { return null; }
}

async function fetchAtendimentos(loja, useDateFilter) {
  const pad = n => String(n).padStart(2, '0');
  const dateFilter = {};
  if (useDateFilter) {
    const [year, month] = MES.split('-').map(Number);
    const first = new Date(Date.UTC(year, month - 1, 1));
    const today = new Date();
    dateFilter['data-inicial'] = `${pad(first.getUTCDate())}/${pad(first.getUTCMonth() + 1)}/${first.getUTCFullYear()}`;
    dateFilter['data-final']   = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;
  }

  const headers = makeHeaders(loja);
  let reqCount = 0;
  const all = [];

  const fetchPage = async page => {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ page: String(page), ...dateFilter }),
    });
    reqCount++;
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    return JSON.parse(text);
  };

  const first = await fetchPage(1);
  if (!Array.isArray(first.Response)) throw new Error(`Resposta inválida: ${JSON.stringify(first).slice(0, 200)}`);
  all.push(...first.Response);
  const totalPages = Number(first['Total pages']) || 1;
  console.log(`    Página 1/${totalPages} → ${first.Response.length} registros`);

  for (let p = 2; p <= totalPages; p++) {
    await new Promise(r => setTimeout(r, 400));
    const data = await fetchPage(p);
    const records = data.Response || [];
    all.push(...records);
    console.log(`    Página ${p}/${totalPages} → ${records.length} registros`);

    const dates = records.map(r => parseDate(r.Data)).filter(Boolean).map(d => d.isoDate).sort();
    if (dates.length) {
      const [year, month] = MES.split('-').map(Number);
      const cutoff = new Date(Date.UTC(year, month - 1, 1));
      cutoff.setUTCDate(cutoff.getUTCDate() - 2);
      if (dates[0] < cutoff.toISOString().slice(0, 10)) {
        console.log(`    ⏹  Data ${dates[0]} anterior ao mês alvo — parando busca.`);
        break;
      }
    }
  }

  return { records: all, reqCount, dateFilter };
}

// ── Mapear atendimentos → vendas diárias ─────────────────────────────────────

function mapAtendimentos(records) {
  const active = records.filter(a => {
    const s = (a.Status || '').toLowerCase();
    return !s.includes('cancel') && !s.includes('exclu');
  });

  const byDateVendedor = new Map();

  for (const a of active) {
    const parsed = parseDate(a.Data);
    if (!parsed || parsed.month !== MES) continue;
    const vendedorRaw = (a.Vendedor || '').trim();
    if (!vendedorRaw) continue;
    const vendedorNome = (VENDEDOR_NOME_OVERRIDES[normalize(vendedorRaw)] || vendedorRaw).toUpperCase().trim();

    const detalhes = {};
    let valorTotal = 0;
    let qtdSm = 0, qtdSvc = 0;

    for (const info of a['Informações do atendimento'] || []) {
      for (const venda of info.Venda || []) {
        const val = safeNum(venda['Valor de venda'] || venda.Valor || 0);
        if (val <= 0) continue;
        const cat = mapGrupo(venda.Grupo || '', venda.Produto || '', venda['Tipo produto'] || '', venda.Subtipo || '', val);
        detalhes[cat] = (detalhes[cat] || 0) + val;
        valorTotal += val;
        if (['BONIFICADO LC', 'SUPER BONIFICADO', 'ANATEL'].includes(cat)) qtdSm += (Number(venda.Quantidade) || 1);
        else if (['PROTEÇÃO LÍDER', 'GARANTIA ESTENDIDA'].includes(cat)) qtdSvc += (Number(venda.Quantidade) || 1);
      }
      for (const b of info.Brinde || []) {
        const val = safeNum(b['Valor de venda'] || b.Valor || 0);
        if (val <= 0) continue;
        const cat = mapGrupo(b.Grupo || '', b.Produto || '', b['Tipo produto'] || '', b.Subtipo || '', val);
        detalhes[cat] = (detalhes[cat] || 0) + val;
        valorTotal += val;
      }
      for (const t of info.Troca || []) {
        const val = safeNum(t['Valor de venda'] || t.Valor || 0);
        if (val === 0) continue;
        const cat = mapGrupo(t.Grupo || '', t.Produto || '', t['Tipo produto'] || '', t.Subtipo || '', val);
        detalhes[cat] = (detalhes[cat] || 0) + val;
        valorTotal += val;
      }
    }

    if (qtdSm > 0) detalhes['__qtd_smartphones'] = qtdSm;
    if (qtdSvc > 0) detalhes['__qtd_servicos'] = qtdSvc;
    if (valorTotal <= 0 && qtdSm === 0) continue;

    const key = `${parsed.isoDate}|${normalize(vendedorNome)}`;
    const ex = byDateVendedor.get(key);
    if (!ex) {
      byDateVendedor.set(key, { data: parsed.isoDate, vendedor_nome: vendedorNome, valor_total: valorTotal, detalhes });
    } else {
      ex.valor_total += valorTotal;
      for (const [k, v] of Object.entries(detalhes)) ex.detalhes[k] = (ex.detalhes[k] || 0) + v;
    }
  }

  return Array.from(byDateVendedor.values());
}

function aggregateMensal(diarias) {
  const map = new Map();
  for (const r of diarias) {
    const ex = map.get(r.vendedor_nome) || { vendedor_nome: r.vendedor_nome, valor_total: 0, detalhes: {} };
    ex.valor_total += r.valor_total;
    for (const [k, v] of Object.entries(r.detalhes)) ex.detalhes[k] = (ex.detalhes[k] || 0) + v;
    map.set(r.vendedor_nome, ex);
  }
  return Array.from(map.values()).sort((a, b) => b.valor_total - a.valor_total);
}

function printVendas(mensal) {
  const fmt = n => `R$ ${n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  const cats = ['BONIFICADO LC', 'SUPER BONIFICADO', 'ANATEL', 'PROTEÇÃO LÍDER', 'GARANTIA ESTENDIDA', 'ACESSÓRIOS', 'CASES', 'PELÍCULA', 'GERAL'];
  const col = (s, w) => String(s).padEnd(w).slice(0, w);

  console.log(`\n  ${'VENDEDOR'.padEnd(20)} ${'TOTAL'.padStart(14)}  ${'SM+'.padStart(10)}  ${'SVC'.padStart(10)}  ${'GERAL'.padStart(10)}`);
  console.log(`  ${'─'.repeat(70)}`);

  for (const v of mensal) {
    const d = v.detalhes;
    const sm  = (d['BONIFICADO LC']||0) + (d['SUPER BONIFICADO']||0) + (d['ANATEL']||0);
    const svc = (d['PROTEÇÃO LÍDER']||0) + (d['GARANTIA ESTENDIDA']||0);
    const ger = d['GERAL'] || 0;
    console.log(`  ${col(v.vendedor_nome,20)} ${fmt(v.valor_total).padStart(14)}  ${fmt(sm).padStart(10)}  ${fmt(svc).padStart(10)}  ${fmt(ger).padStart(10)}`);
  }

  const total = mensal.reduce((s, v) => s + v.valor_total, 0);
  console.log(`  ${'─'.repeat(70)}`);
  console.log(`  ${'TOTAL'.padEnd(20)} ${fmt(total).padStart(14)}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`);
console.log(`  TESTE LOCAL sync-tenfront — mês ${MES}`);
console.log(`  Lojas: ${LOJAS_CONFIG.map(l => l.id).join(', ')}`);
console.log(`${'═'.repeat(60)}`);

const outputTotal = { mes: MES, geradoEm: new Date().toISOString(), lojas: [] };
let totalReqGeral = 0;

for (const loja of LOJAS_CONFIG) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  LOJA: ${loja.id.toUpperCase()}`);
  console.log(`${'─'.repeat(60)}`);

  const saldo = await fetchSaldo(loja);
  console.log(`  Saldo: ${saldo !== null ? JSON.stringify(saldo) : '(não disponível)'}`);

  let records, reqCount, dateFilter;
  try {
    ({ records, reqCount, dateFilter } = await fetchAtendimentos(loja, true));
  } catch (err) {
    console.error(`  ❌ Erro: ${err.message}`);
    outputTotal.lojas.push({ id: loja.id, erro: err.message });
    continue;
  }

  console.log(`  Filtro: ${dateFilter['data-inicial']} a ${dateFilter['data-final']}`);
  console.log(`  Registros recebidos: ${records.length} | Requisições: ${reqCount}`);
  totalReqGeral += reqCount;

  const diarias = mapAtendimentos(records);
  const mensal  = aggregateMensal(diarias);

  console.log(`\n  Vendas ${MES}:`);
  printVendas(mensal);

  // Comparativo sem filtro se solicitado
  if (SEM_FILTRO) {
    console.log(`\n  [sem filtro]`);
    const { records: rOld, reqCount: rqOld } = await fetchAtendimentos(loja, false);
    const mensalOld = aggregateMensal(mapAtendimentos(rOld));
    printVendas(mensalOld);

    console.log(`  Req. com filtro: ${reqCount} | sem filtro: ${rqOld} | economia: ${rqOld - reqCount}`);

    const mapNovo  = Object.fromEntries(mensal.map(v => [v.vendedor_nome, v.valor_total]));
    const mapVelho = Object.fromEntries(mensalOld.map(v => [v.vendedor_nome, v.valor_total]));
    const todos = new Set([...Object.keys(mapNovo), ...Object.keys(mapVelho)]);
    let diff = false;
    for (const nome of todos) {
      const n = mapNovo[nome] || 0, v = mapVelho[nome] || 0;
      if (Math.abs(n - v) > 0.01) {
        if (!diff) { console.log(`  ⚠️  Diferenças:`); diff = true; }
        console.log(`    ${nome}: R$ ${n.toFixed(2)} (novo) vs R$ ${v.toFixed(2)} (atual)`);
      }
    }
    if (!diff) console.log(`  ✅ Totais idênticos.`);
  }

  outputTotal.lojas.push({ id: loja.id, saldo, reqCount, vendas: mensal, diarias });
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`  Total de requisições consumidas neste teste: ${totalReqGeral}`);
const ciclos = Math.floor(350 / Math.max(totalReqGeral, 1));
console.log(`  Projeção diária (350 req): ~${ciclos} ciclos/dia (a cada ~${Math.round(1440 / ciclos)} min)`);

const outFile = join(__dir, `resultado-${MES}.json`);
writeFileSync(outFile, JSON.stringify(outputTotal, null, 2));
console.log(`  💾 Salvo em resultado-${MES}.json`);
console.log(`${'═'.repeat(60)}\n`);

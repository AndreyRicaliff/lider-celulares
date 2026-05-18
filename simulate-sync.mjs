/**
 * Simulação local da edge function sync-tenfront.
 * Lê credenciais de .env.tenfront, compara comportamento
 * ANTES (sem filtro de data) vs DEPOIS (com filtro de data).
 *
 * Uso:
 *   node simulate-sync.mjs
 *   node simulate-sync.mjs --mes 2026-05  (padrão: mês atual)
 *   node simulate-sync.mjs --antes-somente
 *   node simulate-sync.mjs --depois-somente
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Ler credenciais ──────────────────────────────────────────────────────────

function loadEnv(file) {
  try {
    return Object.fromEntries(
      readFileSync(file, 'utf8')
        .split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#'))
        .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim().replace(/^["']|["']$/g, '')]; })
    );
  } catch { return {}; }
}

const env = { ...loadEnv(join(__dir, '.env.tenfront')), ...process.env };
const BEARER = (env.TENFRONT_BEARER || '').replace(/^Bearer\s+/i, '');
const KEY    = env.TENFRONT_CONSUMER_KEY    || '';
const SECRET = env.TENFRONT_CONSUMER_SECRET || '';

if (!BEARER || !KEY || !SECRET) {
  console.error('❌ Credenciais não encontradas. Crie .env.tenfront com:');
  console.error('   TENFRONT_BEARER=...\n   TENFRONT_CONSUMER_KEY=...\n   TENFRONT_CONSUMER_SECRET=...');
  process.exit(1);
}

// ── Parâmetros ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const mesIdx = args.indexOf('--mes');
const now = new Date();
const MES = mesIdx !== -1 ? args[mesIdx + 1] : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const ANTES_SOMENTE  = args.includes('--antes-somente');
const DEPOIS_SOMENTE = args.includes('--depois-somente');

const API_URL    = 'https://api.tenfront.com.br/v1/listar-atendimentos';
const SALDO_URL  = 'https://api.tenfront.com.br/v1/saldo-token';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${BEARER}`,
  'Consumer-key': KEY,
  'Consumer-secret': SECRET,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const pad = n => String(n).padStart(2, '0');

function buildDateFilter(mes) {
  const [year, month] = mes.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const today = new Date();
  return {
    'data-inicial': `${pad(firstDay.getUTCDate())}/${pad(firstDay.getUTCMonth() + 1)}/${firstDay.getUTCFullYear()}`,
    'data-final':   `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`,
  };
}

async function fetchPage(page, extraBody = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ page: String(page), ...extraBody }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function fetchSaldo() {
  try {
    const res = await fetch(SALDO_URL, { method: 'GET', headers });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.saldo_disponivel ?? data?.saldo ?? data?.Response?.saldo_disponivel ?? data?.Response?.saldo ?? data;
  } catch { return null; }
}

async function runSim(label, extraBody = {}, limitPages = 99) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`▶  ${label}`);
  if (Object.keys(extraBody).length)
    console.log(`   Body extra: ${JSON.stringify(extraBody)}`);
  console.log(`${'─'.repeat(60)}`);

  const t0 = Date.now();
  let reqCount = 0;
  let totalRecords = 0;
  const monthsSeen = new Set();
  const datesSeen = [];

  // Página 1
  const first = await fetchPage(1, extraBody);
  reqCount++;
  const totalPages = Math.min(Number(first['Total pages']) || 1, limitPages);
  const p1records = (first.Response || []);
  totalRecords += p1records.length;

  for (const r of p1records) {
    const d = (r.Data || '').slice(0, 10);
    if (d) { datesSeen.push(d); monthsSeen.add(d.slice(3, 10)); }
  }

  console.log(`   Página 1/${totalPages} → ${p1records.length} registros`);

  for (let page = 2; page <= totalPages; page++) {
    await new Promise(r => setTimeout(r, 300)); // delay suave
    const data = await fetchPage(page, extraBody);
    reqCount++;
    const records = data.Response || [];
    totalRecords += records.length;
    for (const r of records) {
      const d = (r.Data || '').slice(0, 10);
      if (d) { datesSeen.push(d); monthsSeen.add(d.slice(3, 10)); }
    }
    console.log(`   Página ${page}/${totalPages} → ${records.length} registros`);
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const datesArr = datesSeen.sort();
  const oldest = datesArr[0] || '—';
  const newest = datesArr[datesArr.length - 1] || '—';

  console.log(`\n   ✅ Resultado:`);
  console.log(`      Requisições consumidas : ${reqCount}`);
  console.log(`      Total de registros     : ${totalRecords}`);
  console.log(`      Meses na resposta      : ${[...monthsSeen].sort().join(', ')}`);
  console.log(`      Data mais antiga       : ${oldest}`);
  console.log(`      Data mais recente      : ${newest}`);
  console.log(`      Tempo                  : ${elapsed}s`);

  return { reqCount, totalRecords, totalPages, monthsSeen: [...monthsSeen] };
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`);
console.log(`  SIMULAÇÃO sync-tenfront — mês ${MES}`);
console.log(`${'═'.repeat(60)}`);

const saldo = await fetchSaldo();
console.log(`\n  Saldo Tenfront: ${saldo !== null ? JSON.stringify(saldo) : '(endpoint não respondeu)'}`);

const dateFilter = buildDateFilter(MES);
console.log(`  Filtro de data: ${dateFilter['data-inicial']} a ${dateFilter['data-final']}`);

const resultados = {};

if (!DEPOIS_SOMENTE) {
  resultados.antes = await runSim('ANTES — sem filtro de data (comportamento atual)', {});
}

if (!ANTES_SOMENTE) {
  resultados.depois = await runSim('DEPOIS — com filtro de data (otimizado)', dateFilter);
}

// ── Comparativo ──────────────────────────────────────────────────────────────

if (resultados.antes && resultados.depois) {
  const { antes, depois } = resultados;
  const reqEconomia = antes.reqCount - depois.reqCount;
  const pct = ((reqEconomia / antes.reqCount) * 100).toFixed(0);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  COMPARATIVO`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Requisições ANTES  : ${antes.reqCount}`);
  console.log(`  Requisições DEPOIS : ${depois.reqCount}`);
  console.log(`  Economia por ciclo : ${reqEconomia} req (${pct}%)`);

  if (saldo !== null && typeof saldo === 'number') {
    const ciclosPossivelAntes  = Math.floor(350 / Math.max(antes.reqCount, 1));
    const ciclosPossivelDepois = Math.floor(350 / Math.max(depois.reqCount, 1));
    console.log(`\n  Com cota de 350 req/dia:`);
    console.log(`    ANTES : ~${ciclosPossivelAntes} ciclos/dia (a cada ${Math.round(1440 / ciclosPossivelAntes)} min)`);
    console.log(`    DEPOIS: ~${ciclosPossivelDepois} ciclos/dia (a cada ${Math.round(1440 / ciclosPossivelDepois)} min)`);
  }

  if (depois.totalRecords === 0 && antes.totalRecords > 0) {
    console.log(`\n  ⚠️  Filtro de data retornou 0 registros — API pode não suportar esse parâmetro.`);
    console.log(`     Verifique os logs acima para confirmar.`);
  } else if (depois.totalRecords === antes.totalRecords) {
    console.log(`\n  ✅ Filtro funciona: mesma quantidade de registros com menos requisições.`);
  } else {
    console.log(`\n  ℹ️  Registros ANTES: ${antes.totalRecords} | DEPOIS: ${depois.totalRecords}`);
    console.log(`     Diferença esperada se a API retorna só o mês filtrado (sem histórico antigo).`);
  }
  console.log(`${'═'.repeat(60)}\n`);
}

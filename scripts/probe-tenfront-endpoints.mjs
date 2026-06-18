// Sonda a API Tenfront atrás de um endpoint de faturamento/relatório consolidado.
// Investigação (protocolo §1): não inventa, testa contra a fonte real.
// Uso: node scripts/probe-tenfront-endpoints.mjs [loja_id]
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lojas = JSON.parse(readFileSync(join(root, 'lojas.json'), 'utf8'));
const lojaId = process.argv[2] || 'campina-grande';
const l = lojas.find((x) => x.id === lojaId);
if (!l) { console.error('loja não encontrada:', lojaId); process.exit(1); }

const BASE = 'https://api.tenfront.com.br/v1';
const clean = (b) => (b.startsWith('Bearer ') ? b.slice(7) : b);
const hdr = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${clean(l.bearer)}`,
  'Consumer-key': l.consumerKey,
  'Consumer-secret': l.consumerSecret,
};

const snippet = (t) => (t || '').replace(/\s+/g, ' ').slice(0, 220);

async function saldo() {
  const url = `${BASE}/saldo-token?Consumer-key=${encodeURIComponent(l.consumerKey)}&Consumer-secret=${encodeURIComponent(l.consumerSecret)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${clean(l.bearer)}` } });
  const d = await res.json().catch(() => ({}));
  const raw = d?.response?.['Saldo diário restante'] ?? d?.response?.saldo ?? '?';
  return raw;
}

// Inspeciona os campos do TOPO do envelope de listar-atendimentos:
// se houver "Total bruto"/"Faturamento" consolidado, não precisa de outro endpoint.
async function envelopeTopo() {
  const res = await fetch(`${BASE}/listar-atendimentos`, {
    method: 'POST', headers: hdr,
    body: JSON.stringify({ page: '1', 'data-inicial': '01/06/2026', 'data-final': '30/06/2026' }),
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { return { erro: 'json inválido', amostra: snippet(text) }; }
  const top = {};
  for (const [k, v] of Object.entries(data)) top[k] = Array.isArray(v) ? `[array ${v.length}]` : v;
  return top;
}

const CANDIDATOS = [
  // 2a leva: padrão real do Tenfront (listar-*, nomes compostos, EN)
  'listar-vendas-diarias', 'listar-faturamento-diario', 'listar-relatorio',
  'listar-faturamento-loja', 'faturamento-diario', 'faturamento-loja',
  'faturamento-mensal', 'venda-diaria', 'listar-venda', 'relatorio-faturamento',
  'listar-pagamentos', 'listar-financeiro', 'sales', 'revenue', 'billing',
];

async function probe(path) {
  const out = { path };
  for (const method of ['POST', 'GET']) {
    try {
      const opts = method === 'POST'
        ? { method, headers: hdr, body: JSON.stringify({ 'data-inicial': '01/06/2026', 'data-final': '30/06/2026' }) }
        : { method, headers: hdr };
      const res = await fetch(`${BASE}/${path}`, opts);
      const text = await res.text();
      out[method] = `${res.status} ${snippet(text)}`;
    } catch (e) { out[method] = `ERRO ${e.message}`; }
    await new Promise((r) => setTimeout(r, 200));
  }
  return out;
}

console.log(`\n=== Loja: ${lojaId} ===`);
const s = await saldo();
console.log(`Saldo Tenfront: ${s} req restantes`);
if (typeof s === 'number' && s < 30) { console.log('⚠️ saldo baixo — abortando probe para não bloquear o sync'); process.exit(0); }

console.log('\n=== Campos do TOPO do envelope (listar-atendimentos) ===');
console.log(JSON.stringify(await envelopeTopo(), null, 2));

console.log('\n=== Probe de endpoints candidatos ===');
for (const c of CANDIDATOS) {
  const r = await probe(c);
  console.log(`\n/${c}\n  POST: ${r.POST}\n  GET:  ${r.GET}`);
}

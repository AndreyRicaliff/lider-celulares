// Isola a causa dos "dados a mais" em Campina-Grande. Puxa o raw de junho e mede
// 4 hipóteses separadamente, com evidência. Uso: node scripts/diag-campina-dup.mjs [loja_id]
import { readFileSync } from 'node:fs';

const lojas = JSON.parse(readFileSync('lojas.json', 'utf8'));
const LOJA = process.argv[2] || 'campina-grande';
const [Y, M] = ['2026', '06'];
const clean = (b) => (b.startsWith('Bearer ') ? b.slice(7) : b);
const VALID = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
const escBs = (r) => { let o = ''; for (let i = 0; i < r.length; i++) { if (r[i] !== '\\') { o += r[i]; continue; } if (VALID.has(r[i + 1])) { o += r[i] + r[i + 1]; i++; continue; } o += '\\\\'; } return o; };
const parse = (t) => { try { return JSON.parse(t); } catch { return JSON.parse(escBs(t)); } };
const num = (v) => { const n = typeof v === 'string' ? parseFloat(v.replace(/\./g, '').replace(',', '.')) : Number(v); return isNaN(n) ? 0 : n; };
const noMes = (d) => { const p = (d || '').split(' ')[0].split('/'); return p[1] === M && p[2] === Y; };
const f = (n) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

const l = lojas.find((x) => x.id === LOJA);
const hdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${clean(l.bearer)}`, 'Consumer-key': l.consumerKey, 'Consumer-secret': l.consumerSecret };
const page = async (p) => parse(await (await fetch('https://api.tenfront.com.br/v1/listar-atendimentos', { method: 'POST', headers: hdr, body: JSON.stringify({ page: String(p), 'data-inicial': `01/${M}/${Y}`, 'data-final': `30/${M}/${Y}` }) })).text());

const d1 = await page(1);
const total = Number(d1['Total pages']) || 1;
const pages = [d1.Response || []];
for (let p = 2; p <= total; p++) { await new Promise((r) => setTimeout(r, 800)); pages.push((await page(p)).Response || []); }

console.log(`\n===== ${LOJA.toUpperCase()} — ${total} páginas =====`);

// HIP 1: atendimentos duplicados entre/dentro de páginas (mesmo ID atendimento)
const all = pages.flat();
const idCount = {};
for (const a of all) { const id = a['ID atendimento']; idCount[id] = (idCount[id] || 0) + 1; }
const dups = Object.entries(idCount).filter(([, n]) => n > 1);
console.log(`\n[HIP 1] Atendimentos no total: ${all.length} | IDs únicos: ${Object.keys(idCount).length} | IDs repetidos: ${dups.length}`);
pages.forEach((pg, i) => console.log(`  página ${i + 1}: ${pg.length} atend`));
if (dups.length) { console.log(`  IDs que aparecem mais de uma vez:`); dups.slice(0, 20).forEach(([id, n]) => console.log(`    ${id} ×${n}`)); }

// Trabalha só com atendimentos únicos + concluídos de junho
const seen = new Set();
const recs = [];
for (const a of all) {
  const id = a['ID atendimento'];
  if (seen.has(id)) continue; seen.add(id);
  if (!noMes(a.Data)) continue;
  const st = (a.Status || '').toLowerCase();
  if (st.includes('cancel') || st.includes('exclu')) continue;
  recs.push(a);
}

// HIP 2: por atendimento, conferir identidade  Total bruto ?= Σ venda(>0) + juros
// HIP 3: atendimentos com Total bruto <= 0 (troca/garantia) mas com itens de venda
// HIP 4: itens de Venda duplicados dentro do mesmo atendimento
let somaVenda = 0, somaBruto = 0, somaJuros = 0;
const anomBrutoVenda = [], brutoNeg = [], itemDup = [];
for (const a of recs) {
  const id = a['ID atendimento'];
  let venda = 0; const itemKeys = {};
  for (const info of a['Informações do atendimento'] || [])
    for (const v of info.Venda || []) {
      const vv = num(v['Valor de venda']);
      if (vv > 0) {
        venda += vv;
        const k = `${v.Produto}|${v.IMEI || ''}|${v['Valor de venda']}`;
        itemKeys[k] = (itemKeys[k] || 0) + 1;
      }
    }
  const juros = (a.Pagamento || []).reduce((s, p) => { const j = num(p['Valor com acréscimo'] || p['Valor informado']) - num(p['Valor informado']); return s + (j > 0 ? j : 0); }, 0);
  const bruto = num(a['Total bruto']);
  somaVenda += venda; somaBruto += bruto; somaJuros += juros;
  const esperado = venda + juros;
  if (Math.abs(bruto - esperado) > 1) anomBrutoVenda.push({ id, data: a.Data, status: a.Status, venda, juros, bruto, diff: bruto - esperado });
  if (bruto <= 0 && venda > 0) brutoNeg.push({ id, data: a.Data, status: a.Status, venda, bruto });
  const reps = Object.entries(itemKeys).filter(([, n]) => n > 1);
  if (reps.length) itemDup.push({ id, reps });
}

console.log(`\n[AGREGADO únicos]  Σ venda=${f(somaVenda)}  Σ juros=${f(somaJuros)}  Σ bruto=${f(somaBruto)}  | venda+juros=${f(somaVenda + somaJuros)}  (venda+juros − bruto = ${f(somaVenda + somaJuros - somaBruto)})`);

console.log(`\n[HIP 2] Atendimentos onde Total bruto ≠ venda+juros: ${anomBrutoVenda.length}`);
anomBrutoVenda.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 15).forEach((x) =>
  console.log(`    ${x.id} [${x.status}] ${x.data} | venda=${f(x.venda)} juros=${f(x.juros)} bruto=${f(x.bruto)}  diff(bruto−esp)=${f(x.diff)}`));

console.log(`\n[HIP 3] Atendimentos com Total bruto ≤ 0 mas com item de venda (troca/garantia): ${brutoNeg.length}`);
brutoNeg.slice(0, 15).forEach((x) => console.log(`    ${x.id} [${x.status}] ${x.data} | venda=${f(x.venda)} bruto=${f(x.bruto)}`));

console.log(`\n[HIP 4] Atendimentos com item de Venda repetido (mesmo Produto|IMEI|valor): ${itemDup.length}`);
itemDup.slice(0, 15).forEach((x) => { console.log(`    ${x.id}:`); x.reps.forEach(([k, n]) => console.log(`        ${k} ×${n}`)); });

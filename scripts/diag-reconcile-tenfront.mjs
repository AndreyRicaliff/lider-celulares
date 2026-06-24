// Reconciliação: descobre a fórmula que reproduz os números oficiais do Tenfront.
// Soma candidatos a partir do raw listar-atendimentos e compara com ① Faturamento
// (Dashboard) e ② Resultado por produto (preço venda / custo / lucro).
// Uso: node scripts/diag-reconcile-tenfront.mjs [loja_id]  (sem arg = todas)
import { readFileSync } from 'node:fs';

const lojas = JSON.parse(readFileSync('lojas.json', 'utf8'));
const MES = '2026-06';
const [Y, M] = MES.split('-');
const clean = (b) => (b.startsWith('Bearer ') ? b.slice(7) : b);
const VALID = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
const escBs = (r) => { let o = ''; for (let i = 0; i < r.length; i++) { if (r[i] !== '\\') { o += r[i]; continue; } if (VALID.has(r[i + 1])) { o += r[i] + r[i + 1]; i++; continue; } o += '\\\\'; } return o; };
const parse = (t) => { try { return JSON.parse(t); } catch { return JSON.parse(escBs(t)); } };
const num = (v) => { const n = typeof v === 'string' ? parseFloat(v.replace(/\./g, '').replace(',', '.')) : Number(v); return isNaN(n) ? 0 : n; };
const noMes = (d) => { const p = (d || '').split(' ')[0].split('/'); return p[1] === M && p[2] === Y; };
const f = (n) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

// Números oficiais do Tenfront (das telas enviadas — Junho/2026)
const OFICIAL = {
  natal:            { fat: 273593.28, pv: 258718.91, custo: 151604.47, lucro: 107114.44 },
  'campina-grande': { fat: 102628.28, pv: 85301.95,  custo: 60150.10,  lucro: 25151.85 },
  caruaru:          { fat: 84844.67,  pv: 75833.01,  custo: 48715.60,  lucro: 27092.44 },
  soledade:         { fat: 30318.43,  pv: 29269.74,  custo: 16282.52,  lucro: 12987.22 },
  monteiro:         { fat: 34574.42,  pv: 32723.94,  custo: 19008.88,  lucro: 13715.06 },
};

async function fetchAll(l) {
  const hdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${clean(l.bearer)}`, 'Consumer-key': l.consumerKey, 'Consumer-secret': l.consumerSecret };
  const page = async (p) => {
    const res = await fetch('https://api.tenfront.com.br/v1/listar-atendimentos', { method: 'POST', headers: hdr, body: JSON.stringify({ page: String(p), 'data-inicial': `01/${M}/${Y}`, 'data-final': `30/${M}/${Y}` }) });
    return parse(await res.text());
  };
  const d1 = await page(1);
  const total = Number(d1['Total pages']) || 1;
  let recs = [...(d1.Response || [])];
  for (let p = 2; p <= total; p++) { await new Promise((r) => setTimeout(r, 800)); const d = await page(p); recs.push(...(d.Response || [])); }
  return recs;
}

function reconcile(recs) {
  let pvItem = 0, custoItem = 0, totBruto = 0, totCusto = 0, totLucro = 0, totDesc = 0, juros = 0, nAt = 0;
  const cancelStatus = {};
  for (const a of recs) {
    if (!noMes(a.Data)) continue;
    const st = (a.Status || '').toLowerCase();
    if (st.includes('cancel') || st.includes('exclu')) { cancelStatus[a.Status] = (cancelStatus[a.Status] || 0) + 1; continue; }
    nAt++;
    totBruto += num(a['Total bruto']); totCusto += num(a['Total custos']); totLucro += num(a['Total lucro']); totDesc += num(a['Total desconto']);
    for (const info of a['Informações do atendimento'] || [])
      for (const v of info.Venda || []) { const vv = num(v['Valor de venda']); if (vv > 0) { pvItem += vv; custoItem += num(v.Custo) * (Number(v.Quantidade) || 1); } }
    for (const p of a.Pagamento || []) { const j = num(p['Valor com acréscimo'] || p['Valor informado']) - num(p['Valor informado']); if (j > 0) juros += j; }
  }
  return { nAt, pvItem, custoItem, totBruto, totCusto, totLucro, totDesc, juros, cancelStatus };
}

const alvo = process.argv[2];
for (const l of lojas) {
  if (alvo && l.id !== alvo) continue;
  const recs = await fetchAll(l);
  const r = reconcile(recs);
  const o = OFICIAL[l.id] || {};
  const chk = (calc, of) => of == null ? '' : (Math.abs(calc - of) < 1 ? ' ✓EXATO' : `  Δ=${f(calc - of)}`);
  console.log(`\n========== ${l.id.toUpperCase()} (${r.nAt} atend concluídos) ==========`);
  console.log(`OFICIAL Tenfront:  ①Faturamento=${f(o.fat)}  ②PreçoVenda=${f(o.pv)}  Custo=${f(o.custo)}  Lucro=${f(o.lucro)}`);
  console.log(`--- candidatos a ② Preço de venda ---`);
  console.log(`  Σ item "Valor de venda"   = ${f(r.pvItem)}${chk(r.pvItem, o.pv)}`);
  console.log(`  Σ atend "Total bruto"     = ${f(r.totBruto)}${chk(r.totBruto, o.pv)}`);
  console.log(`--- candidatos a ① Faturamento ---`);
  console.log(`  Σ "Total bruto"           = ${f(r.totBruto)}${chk(r.totBruto, o.fat)}`);
  console.log(`  Σ valor venda + juros     = ${f(r.pvItem + r.juros)}${chk(r.pvItem + r.juros, o.fat)}`);
  console.log(`  Σ "Total bruto" + juros   = ${f(r.totBruto + r.juros)}${chk(r.totBruto + r.juros, o.fat)}`);
  console.log(`--- custo / lucro ---`);
  console.log(`  Σ "Total custos"          = ${f(r.totCusto)}${chk(r.totCusto, o.custo)}`);
  console.log(`  Σ item Custo*qtd          = ${f(r.custoItem)}${chk(r.custoItem, o.custo)}`);
  console.log(`  Σ "Total lucro"           = ${f(r.totLucro)}${chk(r.totLucro, o.lucro)}`);
  console.log(`  juros=${f(r.juros)}  Total desconto=${f(r.totDesc)}  cancelados=${JSON.stringify(r.cancelStatus)}`);
}

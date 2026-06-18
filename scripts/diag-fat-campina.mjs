// Reconcilia o FATURAMENTO de Campina contra o número oficial atual do Tenfront
// (dashboard 18/06: Faturamento 110.768,65 | Lucro 22.885,09 | 75 atend).
// Puxa fresco e testa muitos candidatos. Uso: node scripts/diag-fat-campina.mjs
import { readFileSync } from 'node:fs';

const lojas = JSON.parse(readFileSync('lojas.json', 'utf8'));
const LOJA = 'campina-grande';
const [Y, M] = ['2026', '06'];
const OFICIAL = { fat: 110768.65, lucro: 22885.09, atend: 75 };

const clean = (b) => (b.startsWith('Bearer ') ? b.slice(7) : b);
const VALID = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
const escBs = (r) => { let o = ''; for (let i = 0; i < r.length; i++) { if (r[i] !== '\\') { o += r[i]; continue; } if (VALID.has(r[i + 1])) { o += r[i] + r[i + 1]; i++; continue; } o += '\\\\'; } return o; };
const parse = (t) => { try { return JSON.parse(t); } catch { return JSON.parse(escBs(t)); } };
const num = (v) => { const n = typeof v === 'string' ? parseFloat(v.replace(/\./g, '').replace(',', '.')) : Number(v); return isNaN(n) ? 0 : n; };
const noMes = (d) => { const p = (d || '').split(' ')[0].split('/'); return p[1] === M && p[2] === Y; };
const f = (n) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const chk = (c, o) => o == null ? '' : (Math.abs(c - o) < 1 ? '  ✓EXATO' : `  Δ=${f(c - o)}`);

const l = lojas.find((x) => x.id === LOJA);
const hdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${clean(l.bearer)}`, 'Consumer-key': l.consumerKey, 'Consumer-secret': l.consumerSecret };
const page = async (p) => parse(await (await fetch('https://api.tenfront.com.br/v1/listar-atendimentos', { method: 'POST', headers: hdr, body: JSON.stringify({ page: String(p), 'data-inicial': `01/${M}/${Y}`, 'data-final': `30/${M}/${Y}` }) })).text());

const d1 = await page(1);
const total = Number(d1['Total pages']) || 1;
let all = [...(d1.Response || [])];
for (let p = 2; p <= total; p++) { await new Promise((r) => setTimeout(r, 800)); all.push(...((await page(p)).Response || [])); }

const recs = all.filter((a) => { if (!noMes(a.Data)) return false; const s = (a.Status || '').toLowerCase(); return !(s.includes('cancel') || s.includes('exclu')); });

const acc = { tBruto: 0, tBrutoPos: 0, tCustos: 0, tLucro: 0, tDesc: 0, juros: 0,
  vVenda: 0, vTodos: 0, vSemDesc: 0, proposta: 0, brutoNegCount: 0 };
for (const a of recs) {
  const bruto = num(a['Total bruto']);
  acc.tBruto += bruto;
  if (bruto > 0) acc.tBrutoPos += bruto; else acc.brutoNegCount++;
  acc.tCustos += num(a['Total custos']);
  acc.tLucro += num(a['Total lucro']);
  acc.tDesc += num(a['Total desconto']);
  for (const p of a.Pagamento || []) { const j = num(p['Valor com acréscimo'] || p['Valor informado']) - num(p['Valor informado']); if (j > 0) acc.juros += j; }
  for (const info of a['Informações do atendimento'] || []) {
    for (const v of info.Venda || []) { const vv = num(v['Valor de venda']); if (vv > 0) { acc.vVenda += vv; acc.vTodos += vv; acc.vSemDesc += vv + num(v.Desconto); } }
    for (const v of info.Brinde || []) { const vv = num(v['Valor de venda']); if (vv > 0) acc.vTodos += vv; }
    for (const v of info.Troca || []) { acc.proposta += num(v.Proposta); const vv = num(v['Valor de venda']); if (vv !== 0) acc.vTodos += vv; }
  }
}

console.log(`\n===== CAMPINA-GRANDE — ${recs.length} atend concluídos (oficial: ${OFICIAL.atend}) =====`);
console.log(`OFICIAL: Faturamento=${f(OFICIAL.fat)}  Lucro=${f(OFICIAL.lucro)}  | bruto<0 no fetch: ${acc.brutoNegCount}\n`);
console.log(`brutos: ΣTotalBruto=${f(acc.tBruto)}  ΣTotalBruto(>0)=${f(acc.tBrutoPos)}  ΣTotalCustos=${f(acc.tCustos)}  ΣTotalLucro=${f(acc.tLucro)}  ΣDesc=${f(acc.tDesc)}  juros=${f(acc.juros)}`);
console.log(`itens:  Σvenda=${f(acc.vVenda)}  Σtodos(v+b+t)=${f(acc.vTodos)}  ΣsemDesc=${f(acc.vSemDesc)}  Σproposta(troca)=${f(acc.proposta)}\n`);

console.log(`--- candidatos a FATURAMENTO (alvo ${f(OFICIAL.fat)}) ---`);
const cand = {
  'Σ Total bruto': acc.tBruto,
  'Σ Total bruto + juros': acc.tBruto + acc.juros,
  'Σ Total bruto + desconto': acc.tBruto + acc.tDesc,
  'Σ Total bruto + juros + desconto': acc.tBruto + acc.juros + acc.tDesc,
  'Σ Total bruto(>0)': acc.tBrutoPos,
  'Σ Total bruto(>0) + juros': acc.tBrutoPos + acc.juros,
  'Σ Total bruto(>0) + desconto': acc.tBrutoPos + acc.tDesc,
  'Σ Total bruto(>0) + juros + desc': acc.tBrutoPos + acc.juros + acc.tDesc,
  'Σ venda + juros': acc.vVenda + acc.juros,
  'Σ venda + juros + desconto': acc.vVenda + acc.juros + acc.tDesc,
  'Σ venda + proposta + juros': acc.vVenda + acc.proposta + acc.juros,
  'Σ semDesc + juros': acc.vSemDesc + acc.juros,
  'Σ todos + juros': acc.vTodos + acc.juros,
  'Σ TotalLucro + TotalCustos': acc.tLucro + acc.tCustos,
};
for (const [k, v] of Object.entries(cand)) console.log(`  ${k.padEnd(34)} = ${f(v).padStart(13)}${chk(v, OFICIAL.fat)}`);

console.log(`\n--- candidatos a LUCRO (alvo ${f(OFICIAL.lucro)}) ---`);
console.log(`  Σ Total lucro                      = ${f(acc.tLucro).padStart(13)}${chk(acc.tLucro, OFICIAL.lucro)}`);
console.log(`  Σ Total bruto − Σ Total custos     = ${f(acc.tBruto - acc.tCustos).padStart(13)}${chk(acc.tBruto - acc.tCustos, OFICIAL.lucro)}`);

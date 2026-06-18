// Analisa o cache de junho (scripts/_cache-junho.json) para fechar a fórmula que
// reproduz os números oficiais do Tenfront. Zero quota (lê do cache).
// Uso: node scripts/analise-formula.mjs
import { readFileSync } from 'node:fs';

const cache = JSON.parse(readFileSync('scripts/_cache-junho.json', 'utf8'));
const num = (v) => { const n = typeof v === 'string' ? parseFloat(v.replace(/\./g, '').replace(',', '.')) : Number(v); return isNaN(n) ? 0 : n; };
const f = (n) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

const OFICIAL = {
  natal:            { fat: 273593.28, pv: 258718.91, custo: 151604.47, lucro: 107114.44 },
  'campina-grande': { fat: 102628.28, pv: 85301.95,  custo: 60150.10,  lucro: 25151.85 },
  caruaru:          { fat: 84844.67,  pv: 75833.01,  custo: 48715.60,  lucro: 27092.44 },
  soledade:         { fat: 30318.43,  pv: 29269.74,  custo: 16282.52,  lucro: 12987.22 },
  monteiro:         { fat: 34574.42,  pv: 32723.94,  custo: 19008.88,  lucro: 13715.06 },
};
const ativo = (a) => { const s = (a.status || '').toLowerCase(); return !(s.includes('cancel') || s.includes('exclu')); };
const chk = (c, o) => o == null ? '' : (Math.abs(c - o) < 1 ? ' ✓' : ` Δ=${f(c - o)}`);

for (const [loja, recs0] of Object.entries(cache)) {
  const recs = recs0.filter(ativo);
  const o = OFICIAL[loja] || {};
  let totBruto = 0, totCusto = 0, totLucro = 0, totDesc = 0, juros = 0;
  let pvVenda = 0, custoVenda = 0, pvTodos = 0;
  const porGrupoTipo = {};
  for (const a of recs) {
    totBruto += num(a.totalBruto); totCusto += num(a.totalCustos); totLucro += num(a.totalLucro); totDesc += num(a.totalDesconto);
    for (const p of a.pagamento || []) { const j = num(p.comAcrescimo || p.informado) - num(p.informado); if (j > 0) juros += j; }
    for (const it of a.itens || []) {
      const vv = num(it.valorVenda), q = Number(it.qtd) || 1, cu = num(it.custo);
      if (it.origem === 'venda') { if (vv > 0) { pvVenda += vv; custoVenda += cu * q; } }
      if (vv > 0) pvTodos += vv;
      const key = `${it.tipo || '?'} / ${it.grupo || '?'}`;
      (porGrupoTipo[key] ??= { v: 0, n: 0, custo: 0 }); porGrupoTipo[key].v += vv; porGrupoTipo[key].n += 1; porGrupoTipo[key].custo += cu * q;
    }
  }
  console.log(`\n========== ${loja.toUpperCase()} (${recs.length} atend) ==========`);
  console.log(`OFICIAL:  ①Fat=${f(o.fat)}  ②PV=${f(o.pv)}  Custo=${f(o.custo)}  Lucro=${f(o.lucro)}`);
  console.log(`① Faturamento  → Σ Total bruto = ${f(totBruto)}${chk(totBruto, o.fat)}`);
  console.log(`② Preço venda  → Σ Total bruto − juros = ${f(totBruto - juros)}${chk(totBruto - juros, o.pv)}`);
  console.log(`               → Σ item Venda valorVenda = ${f(pvVenda)}${chk(pvVenda, o.pv)}`);
  console.log(`Custo          → Σ Total custos = ${f(totCusto)}${chk(totCusto, o.custo)}`);
  console.log(`               → Σ item Venda custo*qtd = ${f(custoVenda)}${chk(custoVenda, o.custo)}`);
  console.log(`Lucro(produto) → ②PV − Custo(itens) = ${f(pvVenda - custoVenda)}${chk(pvVenda - custoVenda, o.lucro)}`);
  console.log(`Lucro(dash)    → Σ Total lucro = ${f(totLucro)}  | juros=${f(juros)} desc=${f(totDesc)}`);
  // Decomposição por Tipo/Grupo para entender o que entra em ② (e o que é "GERAL")
  console.log(`  itens por Tipo/Grupo (valorVenda):`);
  for (const [k, v] of Object.entries(porGrupoTipo).sort((a, b) => b[1].v - a[1].v).slice(0, 12))
    if (v.v > 0.01) console.log(`    ${k.padEnd(40)} ${f(v.v).padStart(13)}  (n=${v.n}, custo=${f(v.custo)})`);
}

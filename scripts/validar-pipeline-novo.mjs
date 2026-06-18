// Simula o pipeline NOVO (A+B) sobre o cache e mostra exatamente o que o app exibirá,
// comparando com os números oficiais do Tenfront. Zero quota.
// Fórmula: Faturamento=Σ "Total bruto"; Líquido=Σ item "Valor de venda";
//          Custo=Σ item "Custo"×qtd; Lucro=Líquido−Custo; Juros=Σ(acréscimo−informado).
import { readFileSync } from 'node:fs';

const cache = JSON.parse(readFileSync('scripts/_cache-junho.json', 'utf8'));
const num = (v) => { const n = typeof v === 'string' ? parseFloat(v.replace(/\./g, '').replace(',', '.')) : Number(v); return isNaN(n) ? 0 : n; };
const f = (n) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const ativo = (a) => { const s = (a.status || '').toLowerCase(); return !(s.includes('cancel') || s.includes('exclu')); };
const OFICIAL = {
  natal: { fat: 273593.28, pv: 258718.91, custo: 151604.47, lucro: 107114.44 },
  'campina-grande': { fat: 102628.28, pv: 85301.95, custo: 60150.10, lucro: 25151.85 },
  caruaru: { fat: 84844.67, pv: 75833.01, custo: 48715.60, lucro: 27092.44 },
  soledade: { fat: 30318.43, pv: 29269.74, custo: 16282.52, lucro: 12987.22 },
  monteiro: { fat: 34574.42, pv: 32723.94, custo: 19008.88, lucro: 13715.06 },
};
const chk = (c, o) => o == null ? '' : (Math.abs(c - o) < 1 ? ' ✓' : ` (Δ ${f(c - o)})`);

console.log('Loja            | Faturamento(①) | Líquido(②)   | Custo        | Lucro       | Margem | Juros');
console.log('-'.repeat(104));
for (const [loja, recs0] of Object.entries(cache)) {
  const recs = recs0.filter(ativo);
  let fat = 0, liq = 0, custo = 0, juros = 0;
  for (const a of recs) {
    fat += num(a.totalBruto);
    for (const p of a.pagamento || []) { const j = num(p.comAcrescimo || p.informado) - num(p.informado); if (j > 0) juros += j; }
    for (const it of a.itens || []) if (it.origem === 'venda') { const vv = num(it.valorVenda); if (vv > 0) { liq += vv; custo += num(it.custo) * (Number(it.qtd) || 1); } }
  }
  const lucro = liq - custo;
  const margem = liq > 0 ? (lucro / liq) * 100 : 0;
  const o = OFICIAL[loja] || {};
  console.log(`${loja.padEnd(15)} | ${f(fat).padStart(13)}${chk(fat, o.fat)} | ${f(liq).padStart(12)}${chk(liq, o.pv)} | ${f(custo).padStart(12)}${chk(custo, o.custo)} | ${f(lucro).padStart(11)}${chk(lucro, o.lucro)} | ${margem.toFixed(1)}% | ${f(juros)}`);
}
console.log('\n✓ = bate com o Tenfront (Δ<R$1). Diferenças maiores = timing de snapshot (venda/cancelamento entre o print e o fetch).');

// Reconcilia contra a tela "Resultado por produto" do Tenfront (Campina, 18/06):
//   Total preço venda = 94.603,81 | Total custo = 66.866,11 | Lucro bruto = 27.737,70 | qtd produtos = 136
// Âncora de sincronia: se nosso fetch der ~136 produtos, é o mesmo instante.
import { readFileSync } from 'node:fs';
const lojas = JSON.parse(readFileSync('lojas.json', 'utf8'));
const LOJA = 'campina-grande';
const [Y, M] = ['2026', '06'];
const ALVO = { preco: 94603.81, custo: 66866.11, lucro: 27737.70, qtd: 136 };

const clean = (b) => (b.startsWith('Bearer ') ? b.slice(7) : b);
const VALID = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
const escBs = (r) => { let o = ''; for (let i = 0; i < r.length; i++) { if (r[i] !== '\\') { o += r[i]; continue; } if (VALID.has(r[i + 1])) { o += r[i] + r[i + 1]; i++; continue; } o += '\\\\'; } return o; };
const parse = (t) => { try { return JSON.parse(t); } catch { return JSON.parse(escBs(t)); } };
const num = (v) => { const n = typeof v === 'string' ? parseFloat(v.replace(/\./g, '').replace(',', '.')) : Number(v); return isNaN(n) ? 0 : n; };
const noMes = (d) => { const p = (d || '').split(' ')[0].split('/'); return p[1] === M && p[2] === Y; };
const f = (n) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const chk = (c, o) => Math.abs(c - o) < 1 ? '  ✓EXATO' : `  Δ=${f(c - o)}`;

const l = lojas.find((x) => x.id === LOJA);
const hdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${clean(l.bearer)}`, 'Consumer-key': l.consumerKey, 'Consumer-secret': l.consumerSecret };
const page = async (p) => parse(await (await fetch('https://api.tenfront.com.br/v1/listar-atendimentos', { method: 'POST', headers: hdr, body: JSON.stringify({ page: String(p), 'data-inicial': `01/${M}/${Y}`, 'data-final': `30/${M}/${Y}` }) })).text());
const d1 = await page(1);
const total = Number(d1['Total pages']) || 1;
let all = [...(d1.Response || [])];
for (let p = 2; p <= total; p++) { await new Promise((r) => setTimeout(r, 800)); all.push(...((await page(p)).Response || [])); }
const recs = all.filter((a) => { if (!noMes(a.Data)) return false; const s = (a.Status || '').toLowerCase(); return !(s.includes('cancel') || s.includes('exclu')); });

// Variantes: incluindo todos atend vs excluindo bruto<0 (seminovo de compra)
const calc = (filterFn, incBrinde, incTroca) => {
  let preco = 0, custo = 0, qtd = 0;
  const porGrupo = {};
  const add = (v) => {
    const pv = num(v['Valor de venda']); if (pv <= 0) return;
    const q = Number(v.Quantidade) || 1;
    preco += pv; custo += num(v.Custo) * q; qtd += q;
    const k = `${v['Tipo produto'] || '?'} / ${v.Grupo || '?'}`;
    (porGrupo[k] ??= { pv: 0, cu: 0, n: 0 }); porGrupo[k].pv += pv; porGrupo[k].cu += num(v.Custo) * q; porGrupo[k].n += q;
  };
  for (const a of recs) {
    if (!filterFn(a)) continue;
    for (const info of a['Informações do atendimento'] || []) {
      for (const v of info.Venda || []) add(v);
      if (incBrinde) for (const v of info.Brinde || []) add(v);
      if (incTroca) for (const v of info.Troca || []) add(v);
    }
  }
  return { preco, custo, qtd, porGrupo };
};

const okBruto = (a) => num(a['Total bruto']) >= 0;
const variantes = [
  ['Venda só (excl. seminovo)', calc(okBruto, false, false)],
  ['Venda+Brinde (excl. seminovo)', calc(okBruto, true, false)],
  ['Venda+Brinde+Troca (excl. seminovo)', calc(okBruto, true, true)],
];

console.log(`\n===== CAMPINA — Resultado por produto (alvo Tenfront) =====`);
console.log(`ALVO: preço=${f(ALVO.preco)}  custo=${f(ALVO.custo)}  lucro=${f(ALVO.lucro)}  qtd=${ALVO.qtd}  | atend=${recs.length}\n`);
const semNeg = variantes[1][1];
for (const [nome, r] of variantes) {
  console.log(`--- ${nome} ---`);
  console.log(`  preço venda = ${f(r.preco).padStart(12)}${chk(r.preco, ALVO.preco)}`);
  console.log(`  custo       = ${f(r.custo).padStart(12)}${chk(r.custo, ALVO.custo)}`);
  console.log(`  lucro       = ${f(r.preco - r.custo).padStart(12)}${chk(r.preco - r.custo, ALVO.lucro)}`);
  console.log(`  qtd itens   = ${String(r.qtd).padStart(12)}${r.qtd === ALVO.qtd ? '  ✓' : `  Δ=${r.qtd - ALVO.qtd}`}\n`);
}
console.log(`--- breakdown por Tipo/Grupo (EXCLUINDO seminovo) ---`);
for (const [k, v] of Object.entries(semNeg.porGrupo).sort((a, b) => b[1].pv - a[1].pv))
  console.log(`  ${k.padEnd(34)} preço=${f(v.pv).padStart(12)}  custo=${f(v.cu).padStart(11)}  n=${v.n}`);

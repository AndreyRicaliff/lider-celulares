// Lista as operações de troca/seminovo de Campina e tenta reproduzir o componente
// de 14.245 que o "Faturamento" do dashboard adiciona sobre o ② Preço de venda.
import { readFileSync } from 'node:fs';
const lojas = JSON.parse(readFileSync('lojas.json', 'utf8'));
const [Y, M] = ['2026', '06'];
const clean = (b) => (b.startsWith('Bearer ') ? b.slice(7) : b);
const VALID = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
const escBs = (r) => { let o = ''; for (let i = 0; i < r.length; i++) { if (r[i] !== '\\') { o += r[i]; continue; } if (VALID.has(r[i + 1])) { o += r[i] + r[i + 1]; i++; continue; } o += '\\\\'; } return o; };
const parse = (t) => { try { return JSON.parse(t); } catch { return JSON.parse(escBs(t)); } };
const num = (v) => { const n = typeof v === 'string' ? parseFloat(v.replace(/\./g, '').replace(',', '.')) : Number(v); return isNaN(n) ? 0 : n; };
const noMes = (d) => { const p = (d || '').split(' ')[0].split('/'); return p[1] === M && p[2] === Y; };
const f = (n) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

const l = lojas.find((x) => x.id === 'campina-grande');
const hdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${clean(l.bearer)}`, 'Consumer-key': l.consumerKey, 'Consumer-secret': l.consumerSecret };
const page = async (p) => parse(await (await fetch('https://api.tenfront.com.br/v1/listar-atendimentos', { method: 'POST', headers: hdr, body: JSON.stringify({ page: String(p), 'data-inicial': `01/${M}/${Y}`, 'data-final': `30/${M}/${Y}` }) })).text());
const d1 = await page(1);
const total = Number(d1['Total pages']) || 1;
let all = [...(d1.Response || [])];
for (let p = 2; p <= total; p++) { await new Promise((r) => setTimeout(r, 800)); all.push(...((await page(p)).Response || [])); }
const recs = all.filter((a) => { if (!noMes(a.Data)) return false; const s = (a.Status || '').toLowerCase(); return !(s.includes('cancel') || s.includes('exclu')); });

let sumProposta = 0, sumSeminovoEntrada = 0, sumTrocaItemVenda = 0;
console.log(`\n===== CAMPINA — operações de troca / seminovo =====\n`);
for (const a of recs) {
  const bruto = num(a['Total bruto']);
  let propostas = [], trocaVendas = 0, seminovoEntrada = 0, temTroca = false, temSemi = false;
  for (const info of a['Informações do atendimento'] || []) {
    for (const t of info.Troca || []) { temTroca = true; const pr = num(t.Proposta); propostas.push(pr); sumProposta += pr; trocaVendas += num(t['Valor de venda']); }
    for (const v of info.Venda || []) { if (/SEMINOVO/i.test(v.Produto || '')) { temSemi = true; if (bruto < 0) seminovoEntrada += num(v['Valor de venda']); } }
  }
  sumTrocaItemVenda += trocaVendas;
  sumSeminovoEntrada += seminovoEntrada;
  if (temTroca || temSemi || bruto < 0) {
    const prods = (a['Informações do atendimento'] || []).flatMap((i) => [
      ...(i.Venda || []).map((v) => `V:${v.Produto}=${f(num(v['Valor de venda']))}`),
      ...(i.Troca || []).map((t) => `T:${t.Produto}=prop ${f(num(t.Proposta))}`),
    ]);
    console.log(`${a['ID atendimento']} [${a.Data}] ${a.Vendedor?.trim()} | bruto=${f(bruto)} desc=${f(num(a['Total desconto']))}`);
    prods.forEach((p) => console.log(`    ${p}`));
  }
}
console.log(`\n--- somatórios candidatos ao componente 14.245,00 ---`);
console.log(`  Σ Proposta (usados recebidos)        = ${f(sumProposta)}`);
console.log(`  Σ entrada seminovo (bruto<0)         = ${f(sumSeminovoEntrada)}`);
console.log(`  Σ Proposta + entrada seminovo        = ${f(sumProposta + sumSeminovoEntrada)}`);
console.log(`  Σ Proposta + |entrada seminovo|·2... veja acima`);

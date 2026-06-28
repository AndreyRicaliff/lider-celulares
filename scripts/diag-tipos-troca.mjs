// Classifica os TIPOS de operação de troca/seminovo em Campina vs Natal, para ver
// se lojas com gaps diferentes usam tipos de troca diferentes.
import { readFileSync } from 'node:fs';
const lojas = JSON.parse(readFileSync('lojas.json', 'utf8'));
const [Y, M] = ['2026', '06'];
const ALVO = ['campina-grande', 'natal'];
const clean = (b) => (b.startsWith('Bearer ') ? b.slice(7) : b);
const VALID = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
const escBs = (r) => { let o = ''; for (let i = 0; i < r.length; i++) { if (r[i] !== '\\') { o += r[i]; continue; } if (VALID.has(r[i + 1])) { o += r[i] + r[i + 1]; i++; continue; } o += '\\\\'; } return o; };
const parse = (t) => { try { return JSON.parse(t); } catch { return JSON.parse(escBs(t)); } };
const num = (v) => { const n = typeof v === 'string' ? parseFloat(v.replace(/\./g, '').replace(',', '.')) : Number(v); return isNaN(n) ? 0 : n; };
const noMes = (d) => { const p = (d || '').split(' ')[0].split('/'); return p[1] === M && p[2] === Y; };
const f = (n) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

const fetchLoja = async (l) => {
  const hdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${clean(l.bearer)}`, 'Consumer-key': l.consumerKey, 'Consumer-secret': l.consumerSecret };
  const page = async (p) => parse(await (await fetch('https://api.tenfront.com.br/v1/listar-atendimentos', { method: 'POST', headers: hdr, body: JSON.stringify({ page: String(p), 'data-inicial': `01/${M}/${Y}`, 'data-final': `30/${M}/${Y}` }) })).text());
  const d1 = await page(1); const total = Number(d1['Total pages']) || 1;
  let all = [...(d1.Response || [])];
  for (let p = 2; p <= total; p++) { await new Promise((r) => setTimeout(r, 800)); all.push(...((await page(p)).Response || [])); }
  return all.filter((a) => { if (!noMes(a.Data)) return false; const s = (a.Status || '').toLowerCase(); return !(s.includes('cancel') || s.includes('exclu')); });
};

for (const id of ALVO) {
  const recs = await fetchLoja(lojas.find((x) => x.id === id));
  // classifica cada atendimento que envolve troca/seminovo
  const tipos = {};
  for (const a of recs) {
    const prefixo = (a['ID atendimento'] || '').split('-')[0];
    let nTroca = 0, propostaTot = 0, vendaSemi = 0, hasSemiVenda = false;
    for (const info of a['Informações do atendimento'] || []) {
      for (const t of info.Troca || []) { nTroca++; propostaTot += num(t.Proposta); }
      for (const v of info.Venda || []) if (/SEMINOVO/i.test(v.Produto || '')) { hasSemiVenda = true; vendaSemi += num(v['Valor de venda']); }
    }
    const bruto = num(a['Total bruto']);
    const envolve = nTroca > 0 || hasSemiVenda || bruto < 0 || prefixo !== 'ATE';
    if (!envolve) continue;
    // chave de tipo
    let tipo;
    if (bruto < 0) tipo = 'COMPRA seminovo (bruto<0)';
    else if (prefixo === 'GAR') tipo = 'GAR (garantia/movimentação)';
    else if (nTroca > 0 && hasSemiVenda) tipo = 'venda c/ troca + item seminovo';
    else if (nTroca > 0) tipo = 'venda c/ TROCA (usado entra)';
    else if (hasSemiVenda) tipo = 'venda de SEMINOVO (sem troca)';
    else tipo = `outro prefixo: ${prefixo}`;
    (tipos[tipo] ??= { n: 0, bruto: 0, proposta: 0, vendaSemi: 0 });
    tipos[tipo].n++; tipos[tipo].bruto += bruto; tipos[tipo].proposta += propostaTot; tipos[tipo].vendaSemi += vendaSemi;
  }
  console.log(`\n===== ${id.toUpperCase()} (${recs.length} atend) — tipos de operação =====`);
  for (const [t, v] of Object.entries(tipos).sort((a, b) => b[1].n - a[1].n))
    console.log(`  ${t.padEnd(34)} n=${String(v.n).padStart(3)}  Σbruto=${f(v.bruto).padStart(12)}  Σproposta=${f(v.proposta).padStart(10)}  ΣvendaSemi=${f(v.vendaSemi).padStart(11)}`);
}

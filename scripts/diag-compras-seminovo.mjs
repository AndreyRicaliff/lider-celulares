// Lista as AQUISIÇÕES de seminovo (loja comprando usado) por loja:
//  (1) compra direta de fornecedor (Total bruto < 0)
//  (2) GAR (garantia/movimentação)
//  (3) usado recebido em troca (campo Proposta)
import { readFileSync } from 'node:fs';
const lojas = JSON.parse(readFileSync('lojas.json', 'utf8'));
const [Y, M] = ['2026', '06'];
const ALVO = ['campina-grande', 'natal', 'caruaru'];
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
  console.log(`\n===== ${id.toUpperCase()} — aquisições de seminovo =====`);
  let totDireta = 0, totProposta = 0;
  for (const a of recs) {
    const bruto = num(a['Total bruto']);
    const prefixo = (a['ID atendimento'] || '').split('-')[0];
    // (1) compra direta / GAR
    if (bruto < 0 || prefixo === 'GAR') {
      for (const info of a['Informações do atendimento'] || [])
        for (const v of [...(info.Venda || []), ...(info.Troca || [])]) {
          const val = num(v['Valor de venda']) || num(v.Proposta);
          console.log(`  [${bruto < 0 ? 'COMPRA' : 'GAR'}] ${a['ID atendimento']} ${a.Data} ${a.Vendedor?.trim()} | ${v.Produto} | val=${f(val)} | forn=${v.Fornecedor || '-'}`);
          if (bruto < 0) totDireta += num(v['Valor de venda']);
        }
    }
    // (3) usado recebido em troca (em atend normal)
    if (bruto >= 0 && prefixo !== 'GAR') {
      for (const info of a['Informações do atendimento'] || [])
        for (const t of info.Troca || []) {
          const pr = num(t.Proposta); totProposta += pr;
          console.log(`  [TROCA-usado] ${a['ID atendimento']} ${a.Data} ${a.Vendedor?.trim()} | ${t.Produto} | proposta=${f(pr)} | IMEI=${t.IMEI || '-'}`);
        }
    }
  }
  console.log(`  --- Σ compra direta (bruto<0): ${f(totDireta)} | Σ proposta (usados em troca): ${f(totProposta)}`);
}

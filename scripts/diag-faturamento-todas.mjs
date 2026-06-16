// Métricas de faturamento por loja (API Tenfront, junho, concluídos) para comparar com o app.
// Mostra: Total bruto, itens (valor de venda = app), desconto, itens+desconto (preço cheio), pagamento informado.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lojas = JSON.parse(readFileSync(join(root, 'lojas.json'), 'utf8'));
const clean = (b) => (b.startsWith('Bearer ') ? b.slice(7) : b);
const VALID = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
const escBs = (r) => { let o = ''; for (let i = 0; i < r.length; i++) { if (r[i] !== '\\') { o += r[i]; continue; } if (VALID.has(r[i + 1])) { o += r[i] + r[i + 1]; i++; continue; } o += '\\\\'; } return o; };
const parse = (t) => { try { return JSON.parse(t); } catch { return JSON.parse(escBs(t)); } };
const ehJun = (d) => { const m = (d || '').split('/'); return m[1] === '06' && (m[2] || '').slice(0, 4) === '2026'; };
const antesJun = (d) => { const m = (d || '').split('/'); return +m[1] < 6 || +(m[2] || '').slice(0, 4) < 2026; };

// faturamento que o app mostra (valor_total do banco), já conhecido das queries anteriores
const APP = { 'campina-grande': 86681.96, caruaru: 73283.02, monteiro: 32343.94, natal: 242337.24, soledade: 26184.63 };

async function metricas(l) {
  const hdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${clean(l.bearer)}`, 'Consumer-key': l.consumerKey, 'Consumer-secret': l.consumerSecret };
  let pages = 1, tb = 0, itens = 0, desc = 0, pInf = 0, n = 0, cancel = 0, itensCancel = 0;
  for (let p = 1; p <= pages; p++) {
    const res = await fetch('https://api.tenfront.com.br/v1/listar-atendimentos', { method: 'POST', headers: hdr, body: JSON.stringify({ page: String(p), 'data-inicial': '01/06/2026', 'data-final': '30/06/2026' }) });
    const data = parse(await res.text());
    if (p === 1) pages = Number(data['Total pages']) || 1;
    for (const at of data.Response || []) {
      if (!ehJun(at.Data)) continue;
      const somaV = (at['Informações do atendimento'] || []).flatMap(i => i.Venda || []).reduce((s, v) => s + (+v['Valor de venda'] || 0), 0);
      if (/cancel|exclu/i.test(at.Status || '')) { cancel++; itensCancel += somaV; continue; }
      n++; tb += +at['Total bruto'] || 0; desc += +at['Total desconto'] || 0; itens += somaV;
      for (const pg of at.Pagamento || []) pInf += +pg['Valor informado'] || 0;
    }
    if ((data.Response || []).every(a => antesJun(a.Data))) break;
    await new Promise(r => setTimeout(r, 200));
  }
  return { n, cancel, tb, itens, desc, pInf, itensCancel };
}

const f = (x) => x.toFixed(0).padStart(8);
console.log('loja          | concl | APP(itens) | TotBruto | itens+desc | itens+canc | desconto | cancel');
console.log('-'.repeat(98));
for (const l of lojas) {
  const m = await metricas(l);
  const precoCheio = m.itens + m.desc;
  const comCancel = m.itens + m.itensCancel;
  console.log(
    `${l.id.padEnd(13)} | ${String(m.n).padStart(5)} | ${f(APP[l.id] || 0)} | ${f(m.tb)} | ${f(precoCheio)} | ${f(comCancel)} | ${f(m.desc)} | ${m.cancel}`
  );
}

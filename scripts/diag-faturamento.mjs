// Compara faturamento de uma loja: API Tenfront (Total bruto + por grupo) vs banco.
// Uso: node scripts/diag-faturamento.mjs <loja_id>
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lojas = JSON.parse(readFileSync(join(root, 'lojas.json'), 'utf8'));
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
  })
);
const lojaId = process.argv[2] || 'campina-grande';
const l = lojas.find(x => x.id === lojaId);
const clean = (b) => (b.startsWith('Bearer ') ? b.slice(7) : b);
const VALID = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
const escBs = (r) => { let o = ''; for (let i = 0; i < r.length; i++) { if (r[i] !== '\\') { o += r[i]; continue; } if (VALID.has(r[i + 1])) { o += r[i] + r[i + 1]; i++; continue; } o += '\\\\'; } return o; };
const parse = (t) => { try { return JSON.parse(t); } catch { return JSON.parse(escBs(t)); } };
const ehJun = (d) => { const m = (d || '').split('/'); return m[1] === '06' && (m[2] || '').slice(0, 4) === '2026'; };
const antesJun = (d) => { const m = (d || '').split('/'); const mm = +m[1], yy = +(m[2] || '').slice(0, 4); return yy < 2026 || (yy === 2026 && mm < 6); };

const hdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${clean(l.bearer)}`, 'Consumer-key': l.consumerKey, 'Consumer-secret': l.consumerSecret };
async function page(p) {
  const res = await fetch('https://api.tenfront.com.br/v1/listar-atendimentos', { method: 'POST', headers: hdr, body: JSON.stringify({ page: String(p), 'data-inicial': '01/06/2026', 'data-final': '30/06/2026' }) });
  return parse(await res.text());
}

const porGrupo = {}, statusCount = {};
let pages = 1, totalBruto = 0, somaItens = 0, cancelados = 0, atend = 0;
let canceladoBruto = 0, canceladoItens = 0;
for (let p = 1; p <= pages; p++) {
  const data = await page(p);
  if (p === 1) pages = Number(data['Total pages']) || 1;
  const itens = data.Response || [];
  for (const at of itens) {
    if (!ehJun(at.Data)) continue;
    statusCount[at.Status || '?'] = (statusCount[at.Status || '?'] || 0) + 1;
    const cancel = /cancel|exclu/i.test(at.Status || '');
    const itensVenda = (at['Informações do atendimento'] || []).flatMap(i => i.Venda || []);
    const somaAt = itensVenda.reduce((s, v) => s + (Number(v['Valor de venda']) || 0), 0);
    if (cancel) { cancelados++; canceladoBruto += Number(at['Total bruto']) || 0; canceladoItens += somaAt; continue; }
    atend++;
    totalBruto += Number(at['Total bruto']) || 0;
    somaItens += somaAt;
    for (const v of itensVenda) { const g = v.Grupo || '?'; porGrupo[g] = (porGrupo[g] || 0) + (Number(v['Valor de venda']) || 0); }
  }
  if (itens.length && itens.every(a => antesJun(a.Data))) break;
  await new Promise(r => setTimeout(r, 200));
}
console.log('STATUS dos atendimentos:', JSON.stringify(statusCount));
console.log(`CANCELADOS: ${cancelados} atend | Total bruto R$ ${canceladoBruto.toFixed(2)} | itens R$ ${canceladoItens.toFixed(2)}`);
console.log(`CONCLUÍDO + CANCELADO (itens): R$ ${(somaItens + canceladoItens).toFixed(2)}`);

const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: vendas } = await sb.from('vendas').select('valor_total').eq('loja_id', lojaId).eq('mes', '2026-06');
const bancoTotal = (vendas || []).reduce((s, v) => s + (Number(v.valor_total) || 0), 0);

console.log(`\n=== FATURAMENTO ${lojaId} junho (concluídos: ${atend}, cancelados ignorados: ${cancelados}) ===`);
console.log('API "Total bruto" (soma atendimentos):  R$', totalBruto.toFixed(2));
console.log('API soma "Valor de venda" dos itens:    R$', somaItens.toFixed(2));
console.log('BANCO vendas.valor_total (= card app):  R$', bancoTotal.toFixed(2));
console.log('\nAPI por GRUPO (Valor de venda):');
for (const [g, v] of Object.entries(porGrupo).sort((a, b) => b[1] - a[1])) console.log('  ' + g.padEnd(22) + 'R$ ' + v.toFixed(2).padStart(12));

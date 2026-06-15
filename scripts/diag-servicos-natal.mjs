// Soma o "Valor de venda" dos itens por GRUPO na API Tenfront (natal, junho).
// Objetivo: comparar o que o Tenfront chama de SERVIÇOS com o nosso banco.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lojas = JSON.parse(readFileSync(join(root, 'lojas.json'), 'utf8'));
const l = lojas.find(x => x.id === 'natal');
const clean = (b) => (b.startsWith('Bearer ') ? b.slice(7) : b);
const VALID = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
const escBs = (r) => { let o = ''; for (let i = 0; i < r.length; i++) { if (r[i] !== '\\') { o += r[i]; continue; } if (VALID.has(r[i + 1])) { o += r[i] + r[i + 1]; i++; continue; } o += '\\\\'; } return o; };
const parse = (t) => { try { return JSON.parse(t); } catch { return JSON.parse(escBs(t)); } };
const ehJunho = (d) => { const m = (d || '').split('/'); return m[1] === '06' && (m[2] || '').slice(0, 4) === '2026'; };
const antesJun = (d) => { const m = (d || '').split('/'); const mm = +m[1], yy = +(m[2] || '').slice(0, 4); return yy < 2026 || (yy === 2026 && mm < 6); };

const hdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${clean(l.bearer)}`, 'Consumer-key': l.consumerKey, 'Consumer-secret': l.consumerSecret };
async function page(p) {
  const res = await fetch('https://api.tenfront.com.br/v1/listar-atendimentos', { method: 'POST', headers: hdr, body: JSON.stringify({ page: String(p), 'data-inicial': '01/06/2026', 'data-final': '30/06/2026' }) });
  return parse(await res.text());
}

const porGrupo = {}, servProdutos = {};
let pages = 1, atendJunho = 0, totalGeralJunho = 0;
for (let p = 1; p <= pages; p++) {
  const data = await page(p);
  if (p === 1) pages = Number(data['Total pages']) || 1;
  const itens = data.Response || [];
  for (const at of itens) {
    if (!ehJunho(at.Data)) continue;
    atendJunho++;
    for (const info of at['Informações do atendimento'] || []) {
      for (const v of info.Venda || []) {
        const g = v.Grupo || '?', val = Number(v['Valor de venda']) || 0;
        porGrupo[g] = (porGrupo[g] || 0) + val;
        totalGeralJunho += val;
        if (g === 'SERVIÇOS') servProdutos[v.Produto] = (servProdutos[v.Produto] || 0) + val;
      }
    }
  }
  if (itens.length && itens.every(at => antesJun(at.Data))) break;
  await new Promise(r => setTimeout(r, 120));
}

console.log(`NATAL junho — ${atendJunho} atendimentos. Soma "Valor de venda" por GRUPO:`);
for (const [g, v] of Object.entries(porGrupo).sort((a, b) => b[1] - a[1]))
  console.log('  ' + g.padEnd(22) + 'R$ ' + v.toFixed(2).padStart(13));
console.log('  ' + '-'.repeat(40) + '\n  TOTAL GERAL'.padEnd(24) + 'R$ ' + totalGeralJunho.toFixed(2).padStart(13));
console.log('\nItens dentro do grupo SERVIÇOS:');
for (const [pr, v] of Object.entries(servProdutos).sort((a, b) => b[1] - a[1]))
  console.log('  ' + pr.padEnd(22) + 'R$ ' + v.toFixed(2).padStart(13));

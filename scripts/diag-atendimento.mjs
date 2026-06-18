// Dump do raw de atendimentos específicos (sem PII) para inspecionar estrutura.
// Uso: node scripts/diag-atendimento.mjs <loja_id> <ID1> [ID2...]
import { readFileSync, writeFileSync } from 'node:fs';

const lojas = JSON.parse(readFileSync('lojas.json', 'utf8'));
const [, , LOJA, ...IDS] = process.argv;
const [Y, M] = ['2026', '06'];
const clean = (b) => (b.startsWith('Bearer ') ? b.slice(7) : b);
const VALID = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
const escBs = (r) => { let o = ''; for (let i = 0; i < r.length; i++) { if (r[i] !== '\\') { o += r[i]; continue; } if (VALID.has(r[i + 1])) { o += r[i] + r[i + 1]; i++; continue; } o += '\\\\'; } return o; };
const parse = (t) => { try { return JSON.parse(t); } catch { return JSON.parse(escBs(t)); } };

const l = lojas.find((x) => x.id === LOJA);
const hdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${clean(l.bearer)}`, 'Consumer-key': l.consumerKey, 'Consumer-secret': l.consumerSecret };
const page = async (p) => parse(await (await fetch('https://api.tenfront.com.br/v1/listar-atendimentos', { method: 'POST', headers: hdr, body: JSON.stringify({ page: String(p), 'data-inicial': `01/${M}/${Y}`, 'data-final': `30/${M}/${Y}` }) })).text());

const d1 = await page(1);
const total = Number(d1['Total pages']) || 1;
let all = [...(d1.Response || [])];
for (let p = 2; p <= total; p++) { await new Promise((r) => setTimeout(r, 800)); all.push(...((await page(p)).Response || [])); }

// Remove PII antes de imprimir/salvar
const strip = (a) => { const c = { ...a }; delete c.Cliente; delete c['Telefone do cliente']; delete c.Atendente; delete c.Telefone; return c; };
for (const id of IDS) {
  const a = all.find((x) => x['ID atendimento'] === id);
  console.log(`\n========== ${id} ==========`);
  console.log(a ? JSON.stringify(strip(a), null, 2) : 'NÃO ENCONTRADO');
}

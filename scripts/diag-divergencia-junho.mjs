// Compara contagem de atendimentos de junho: API Tenfront (fonte) vs nosso banco.
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
const API = 'https://api.tenfront.com.br/v1/listar-atendimentos';
const clean = (b) => (b.startsWith('Bearer ') ? b.slice(7) : b);

const VALID = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
const escBs = (raw) => { let o = ''; for (let i = 0; i < raw.length; i++) { if (raw[i] !== '\\') { o += raw[i]; continue; } if (VALID.has(raw[i + 1])) { o += raw[i] + raw[i + 1]; i++; continue; } o += '\\\\'; } return o; };
const parse = (t) => { try { return JSON.parse(t); } catch { return JSON.parse(escBs(t)); } };

async function fetchPage(loja, page) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clean(loja.bearer)}`, 'Consumer-key': loja.consumerKey, 'Consumer-secret': loja.consumerSecret },
    body: JSON.stringify({ page: String(page), 'data-inicial': '01/06/2026', 'data-final': '30/06/2026' }),
  });
  return parse(await res.text());
}

const ehJunho = (d) => { const m = (d || '').split('/'); return m[1] === '06' && (m[2] || '').slice(0, 4) === '2026'; };
const ehAntesDeJunho = (d) => { const m = (d || '').split('/'); const mm = +m[1], yy = +(m[2] || '').slice(0, 4); return yy < 2026 || (yy === 2026 && mm < 6); };

// API ignora filtro de data e devolve TODO o historico newest-first.
// Contamos so junho e paramos quando a pagina ja entrou em meses anteriores.
async function contaTenfront(loja) {
  let junho = 0, pages = 1, comServico = 0, pagsLidas = 0;
  for (let p = 1; p <= pages; p++) {
    let data;
    try { data = await fetchPage(loja, p); } catch (e) { return { erro: `pág ${p}: ${e.message}` }; }
    if (p === 1) pages = Number(data['Total pages']) || 1;
    const itens = data.Response || [];
    pagsLidas++;
    for (const at of itens) {
      if (!ehJunho(at.Data)) continue;
      junho++;
      if (JSON.stringify(at).match(/PROTE[ÇC][ÃA]O|GARANTIA ESTENDIDA/i)) comServico++;
    }
    // newest-first: se a pagina inteira ja eh anterior a junho, paramos
    if (itens.length && itens.every(at => ehAntesDeJunho(at.Data))) break;
    await new Promise(r => setTimeout(r, 120));
  }
  return { total: junho, pages: pagsLidas, comServico };
}

const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

console.log('loja            | Tenfront(jun) | páginas | c/serviço | banco(audit) | Δ');
for (const l of lojas) {
  const tf = await contaTenfront(l);
  if (tf.erro) { console.log(`${l.id.padEnd(15)} | ERRO: ${tf.erro}`); continue; }
  const { count } = await sb.from('atendimentos_audit').select('*', { count: 'exact', head: true }).eq('loja_id', l.id).eq('mes', '2026-06');
  const delta = tf.total - (count ?? 0);
  console.log(`${l.id.padEnd(15)} | ${String(tf.total).padStart(13)} | ${String(tf.pages).padStart(7)} | ${String(tf.comServico).padStart(9)} | ${String(count ?? 0).padStart(12)} | ${delta > 0 ? '+' : ''}${delta}${delta !== 0 ? '  ⚠️' : ' ✓'}`);
}

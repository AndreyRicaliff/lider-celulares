// Verifica, por loja, se PROTEÇÃO+GARANTIA no banco batem com a API Tenfront (junho).
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
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const clean = (b) => (b.startsWith('Bearer ') ? b.slice(7) : b);
const VALID = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
const escBs = (r) => { let o = ''; for (let i = 0; i < r.length; i++) { if (r[i] !== '\\') { o += r[i]; continue; } if (VALID.has(r[i + 1])) { o += r[i] + r[i + 1]; i++; continue; } o += '\\\\'; } return o; };
const parse = (t) => { try { return JSON.parse(t); } catch { return JSON.parse(escBs(t)); } };
const ehJun = (d) => { const m = (d || '').split('/'); return m[1] === '06' && (m[2] || '').slice(0, 4) === '2026'; };
const antesJun = (d) => { const m = (d || '').split('/'); const mm = +m[1], yy = +(m[2] || '').slice(0, 4); return yy < 2026 || (yy === 2026 && mm < 6); };

async function apiServicos(loja) {
  const hdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${clean(loja.bearer)}`, 'Consumer-key': loja.consumerKey, 'Consumer-secret': loja.consumerSecret };
  let pages = 1, prot = 0, gar = 0;
  for (let p = 1; p <= pages; p++) {
    const res = await fetch('https://api.tenfront.com.br/v1/listar-atendimentos', { method: 'POST', headers: hdr, body: JSON.stringify({ page: String(p), 'data-inicial': '01/06/2026', 'data-final': '30/06/2026' }) });
    const txt = await res.text();
    if (res.status !== 200) { console.error(`  [${loja.id} p${p}] HTTP ${res.status}: ${txt.slice(0, 80)}`); await new Promise(r => setTimeout(r, 7000)); p--; continue; }
    const data = parse(txt);
    if (p === 1) pages = Number(data['Total pages']) || 1;
    const itens = data.Response || [];
    for (const at of itens) {
      if (!ehJun(at.Data)) continue;
      for (const info of at['Informações do atendimento'] || [])
        for (const v of info.Venda || []) {
          // somar por NOME do produto em qualquer grupo (como a edge function classifica)
          const pr = (v.Produto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(), val = Number(v['Valor de venda']) || 0;
          if (pr.includes('PROTE') || pr.includes('BLINDAGEM')) prot += val; else if (pr.includes('GARANTIA')) gar += val;
        }
    }
    if (itens.length && itens.every(at => antesJun(at.Data))) break;
    await new Promise(r => setTimeout(r, 3000));
  }
  return { prot, gar };
}

console.log('loja            | PROT banco | PROT API | GAR banco | GAR API | OK?');
for (const l of lojas) {
  const { data } = await sb.from('vendas').select('detalhes').eq('loja_id', l.id).eq('mes', '2026-06');
  const banco = (data || []).reduce((a, r) => { const d = typeof r.detalhes === 'string' ? JSON.parse(r.detalhes) : (r.detalhes || {}); a.prot += +(d['PROTEÇÃO LÍDER'] || 0); a.gar += +(d['GARANTIA ESTENDIDA'] || 0); return a; }, { prot: 0, gar: 0 });
  const api = await apiServicos(l);
  const ok = Math.abs(banco.prot - api.prot) < 1 && Math.abs(banco.gar - api.gar) < 1;
  console.log(`${l.id.padEnd(15)} | ${banco.prot.toFixed(0).padStart(10)} | ${api.prot.toFixed(0).padStart(8)} | ${banco.gar.toFixed(0).padStart(9)} | ${api.gar.toFixed(0).padStart(7)} | ${ok ? '✓' : '⚠️ DIVERGE'}`);
}

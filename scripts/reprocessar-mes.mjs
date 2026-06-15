// Reprocessa um mes de uma loja: backup -> limpa -> re-sync (edge function reconstroi).
// Uso: node scripts/reprocessar-mes.mjs <loja_id> <mes>   ex: natal 2026-06
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
  })
);
const URL = env.VITE_SUPABASE_URL;
const sb = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ANON = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

const loja = process.argv[2], mes = process.argv[3];
if (!loja || !mes) { console.log('uso: node scripts/reprocessar-mes.mjs <loja_id> <mes>'); process.exit(1); }
const TABELAS = ['vendas', 'vendas_diarias', 'atendimentos_audit'];

const protGar = (rows) => rows.reduce((acc, r) => {
  const d = typeof r.detalhes === 'string' ? JSON.parse(r.detalhes) : (r.detalhes || {});
  acc.prot += Number(d['PROTEÇÃO LÍDER'] || 0); acc.gar += Number(d['GARANTIA ESTENDIDA'] || 0); return acc;
}, { prot: 0, gar: 0 });

// 1) backup
const backup = {};
for (const t of TABELAS) {
  const { data } = await sb.from(t).select('*').eq('loja_id', loja).eq('mes', mes);
  backup[t] = data || [];
}
const antes = protGar(backup.vendas);
const bkPath = join(root, 'scripts', `reproc-backup-${loja}-${mes}.json`);
writeFileSync(bkPath, JSON.stringify(backup, null, 2));
console.log(`backup: vendas=${backup.vendas.length} vendas_diarias=${backup.vendas_diarias.length} audit=${backup.atendimentos_audit.length} -> ${bkPath}`);
console.log(`  ANTES: PROTEÇÃO=${antes.prot.toFixed(2)} GARANTIA=${antes.gar.toFixed(2)}`);

// 2) limpar (solta o ID-stop)
for (const t of TABELAS) {
  const { error } = await sb.from(t).delete().eq('loja_id', loja).eq('mes', mes);
  if (error) { console.log(`✗ delete ${t}: ${error.message}`); process.exit(1); }
}
console.log('limpo. disparando re-sync...');

// 3) re-sync via edge function (reconstroi do zero, sem ancora ID-stop)
const res = await fetch(`${URL}/functions/v1/sync-tenfront`, {
  method: 'POST', headers: { Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ force: true, loja_id: loja, mes }),
});
console.log('sync:', (await res.text()).slice(0, 300));

// 4) reler e comparar
const { data: depoisV } = await sb.from('vendas').select('*').eq('loja_id', loja).eq('mes', mes);
const depois = protGar(depoisV || []);
console.log(`  DEPOIS: PROTEÇÃO=${depois.prot.toFixed(2)} GARANTIA=${depois.gar.toFixed(2)}  (vendas=${(depoisV || []).length} registros)`);

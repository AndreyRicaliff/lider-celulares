// Valida logins reais + escopo RLS. Uso: node scripts/validate-acessos.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
  })
);
const URL = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const PASS = 'LiderCel@2026';
const amostra = [
  ['admin', 'admin@lidercelulares.local'],
  ['gerente-natal', 'raniel.natal@lidercelulares.local'],
  ['vendedor-natal', 'herbert.natal@lidercelulares.local'],
  ['supervisor', 'cid@lidercelulares.local'],
];

console.log('perfil          | login | vendas | comissoes | colaboradores | lojas_em_vendas');
for (const [k, email] of amostra) {
  const sb = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInWithPassword({ email, password: PASS });
  if (error) { console.log(`${k.padEnd(15)} | ERRO: ${error.message}`); continue; }
  const v = await sb.from('vendas').select('loja_id', { count: 'exact' });
  const c = await sb.from('comissoes').select('*', { count: 'exact', head: true });
  const co = await sb.from('colaboradores').select('*', { count: 'exact', head: true });
  const lojas = v.data ? [...new Set(v.data.map(r => r.loja_id))].sort().join(',') : '-';
  console.log(`${k.padEnd(15)} | OK    | ${String(v.count).padStart(6)} | ${String(c.count).padStart(9)} | ${String(co.count).padStart(13)} | ${lojas || '-'}`);
  await sb.auth.signOut();
}

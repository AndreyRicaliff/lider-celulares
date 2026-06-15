// Valida RLS logando como cada usuário de teste e contando linhas visíveis.
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
const PASS = 'TesteRLS!2026';
const emails = { admin: 'teste-admin@rls.test', sup: 'teste-sup@rls.test', gerente: 'teste-gerente@rls.test', vendedor: 'teste-vendedor@rls.test' };
const TABLES = ['vendas', 'vendas_diarias', 'comissoes', 'colaboradores'];

async function countsFor(email) {
  const sb = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInWithPassword({ email, password: PASS });
  if (error) return { erro: error.message };
  const out = {};
  for (const t of TABLES) {
    const { count, error: e } = await sb.from(t).select('*', { count: 'exact', head: true });
    out[t] = e ? 'ERR' : count;
  }
  // lojas distintas visíveis em vendas
  const { data } = await sb.from('vendas').select('loja_id');
  out.lojas_em_vendas = data ? [...new Set(data.map(r => r.loja_id))].sort().join(',') || '-' : '-';
  await sb.auth.signOut();
  return out;
}

console.log('perfil    | vendas | vd_diarias | comissoes | colaboradores | lojas_em_vendas');
for (const [key, email] of Object.entries(emails)) {
  const c = await countsFor(email);
  if (c.erro) { console.log(`${key.padEnd(9)} | LOGIN ERRO: ${c.erro}`); continue; }
  console.log(`${key.padEnd(9)} | ${String(c.vendas).padStart(6)} | ${String(c.vendas_diarias).padStart(10)} | ${String(c.comissoes).padStart(9)} | ${String(c.colaboradores).padStart(13)} | ${c.lojas_em_vendas}`);
}

// Testa RLS de escrita por papel. Usa um registro descartavel em configuracoes (mes 2099-12).
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
const URL = env.VITE_SUPABASE_URL, ANON = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const csv = readFileSync(join(root, 'scripts', 'acessos-credenciais.csv'), 'utf8').trim().split('\n').slice(1).map(r => r.split(','));
const pick = (pred) => csv.find(pred);
const senhaDe = (email) => (csv.find(r => r[0] === email) || [])[1];
const MES_TESTE = '2099-12';

async function login(email) {
  const sb = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInWithPassword({ email, password: senhaDe(email) });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return sb;
}

async function tentaInsert(sb, label) {
  const { error } = await sb.from('configuracoes').insert({ loja_id: 'natal', mes: MES_TESTE, config: { _teste_rls: true } });
  if (error) return `${label.padEnd(22)} 🔒 bloqueado (${error.message.slice(0, 40)})`;
  return `${label.padEnd(22)} ⚠️ PERMITIDO (não deveria, exceto admin)`;
}

const alvos = [
  ['VENDEDOR', pick(r => r[5] === 'Vendedor')[0]],
  ['GERENTE', pick(r => r[5] === 'Gerente')[0]],
  ['SUPERVISAO', pick(r => r[2] === 'supervisao')[0]],
  ['ADMIN', pick(r => r[2] === 'admin')[0]],
];

console.log('=== INSERT em configuracoes (só admin deve passar) ===');
for (const [label, email] of alvos) {
  const sb = await login(email);
  console.log(await tentaInsert(sb, label + ' ' + email.split('@')[0]));
  await sb.auth.signOut();
}

// cleanup do registro de teste (admin pode ter inserido) via service_role
const svc = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
await svc.from('configuracoes').delete().eq('mes', MES_TESTE);
console.log('\n(cleanup: registros de teste mes', MES_TESTE, 'removidos)');

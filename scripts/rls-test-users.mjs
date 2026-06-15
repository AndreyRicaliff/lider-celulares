// Cria usuários de teste por role para validar RLS. Idempotente-ish (deleta antes).
// Uso: node scripts/rls-test-users.mjs create | cleanup
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
  })
);
const URL = env.VITE_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
const STATE = join(root, 'scripts', '.rls-test-state.json');
const PASS = 'TesteRLS!2026';
const LOJA = 'natal';

const USERS = [
  { key: 'admin', email: 'teste-admin@rls.test', role: 'admin', colaborador: null },
  { key: 'sup', email: 'teste-sup@rls.test', role: 'supervisao', colaborador: null },
  { key: 'gerente', email: 'teste-gerente@rls.test', role: 'colaborador', colaborador: { nome: 'TESTE GERENTE RLS', loja_id: LOJA, cargo: 'Gerente' } },
  { key: 'vendedor', email: 'teste-vendedor@rls.test', role: 'colaborador', colaborador: { nome: 'TESTE VENDEDOR RLS', loja_id: LOJA, cargo: 'Vendedor' } },
];

async function findUserByEmail(email) {
  const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data.users.find(u => u.email === email) || null;
}

async function cleanup() {
  const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
  for (const u of USERS) {
    const existing = await findUserByEmail(u.email);
    if (existing) {
      await sb.from('user_roles').delete().eq('user_id', existing.id);
      await sb.auth.admin.deleteUser(existing.id);
    }
  }
  for (const id of state.colaboradorIds || []) await sb.from('colaboradores').delete().eq('id', id);
  console.log('cleanup ok');
}

async function create() {
  await cleanup();
  const out = { users: {}, colaboradorIds: [] };
  for (const u of USERS) {
    const { data, error } = await sb.auth.admin.createUser({ email: u.email, password: PASS, email_confirm: true });
    if (error) throw new Error(`createUser ${u.email}: ${error.message}`);
    const userId = data.user.id;
    let colaboradorId = null;
    if (u.colaborador) {
      const { data: col, error: ce } = await sb.from('colaboradores').insert(u.colaborador).select('id').single();
      if (ce) throw new Error(`colaborador ${u.key}: ${ce.message}`);
      colaboradorId = col.id;
      out.colaboradorIds.push(colaboradorId);
    }
    const { error: re } = await sb.from('user_roles').insert({ user_id: userId, role: u.role, colaborador_id: colaboradorId });
    if (re) throw new Error(`user_roles ${u.key}: ${re.message}`);
    out.users[u.key] = { email: u.email, userId, colaboradorId, loja: u.colaborador?.loja_id || null };
    console.log(`✓ ${u.key.padEnd(9)} ${u.email} role=${u.role} colaborador=${colaboradorId || '-'}`);
  }
  writeFileSync(STATE, JSON.stringify(out, null, 2));
  console.log('\nstate salvo em', STATE);
}

const cmd = process.argv[2];
if (cmd === 'create') await create();
else if (cmd === 'cleanup') await cleanup();
else console.log('uso: node scripts/rls-test-users.mjs create|cleanup');

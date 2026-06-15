// Configura os acessos do zero: 1 login por colaborador + 1 admin.
// Email gerado (nome.loja@lidercelulares.local), senha temporaria unica.
// Uso: node scripts/setup-acessos.mjs dry      -> mostra o plano (nao aplica)
//      node scripts/setup-acessos.mjs run      -> backup + wipe + cria + relatorio
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
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const SENHA = 'LiderCel@2026';
const DOMINIO = 'lidercelulares.local';
const ADMIN_EMAIL = `admin@${DOMINIO}`;

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '.');

function buildPlan(colaboradores) {
  const used = new Set();
  const mkEmail = (nome, loja) => {
    const base = loja ? `${slug(nome)}.${slug(loja)}` : slug(nome);
    let email = `${base}@${DOMINIO}`, n = 1;
    while (used.has(email)) email = `${base}${++n}@${DOMINIO}`;
    used.add(email);
    return email;
  };
  const plan = colaboradores.map(c => ({
    nome: c.nome, loja: c.loja_id, cargo: c.cargo, colaborador_id: c.id,
    role: c.cargo === 'Supervisor' ? 'supervisao' : 'colaborador',
    email: mkEmail(c.nome, c.loja_id),
  }));
  plan.unshift({ nome: 'ADMINISTRADOR', loja: null, cargo: 'Admin', colaborador_id: null, role: 'admin', email: ADMIN_EMAIL });
  return plan;
}

async function getColaboradores() {
  const { data, error } = await sb.from('colaboradores').select('id, nome, loja_id, cargo').order('loja_id').order('cargo');
  if (error) throw new Error('colaboradores: ' + error.message);
  return data;
}

async function listAllAuthUsers() {
  const all = []; let page = 1;
  for (;;) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error('listUsers: ' + error.message);
    all.push(...data.users);
    if (data.users.length < 1000) break;
    page++;
  }
  return all;
}

async function dry() {
  const plan = buildPlan(await getColaboradores());
  console.log(`PLANO (${plan.length} logins) — senha temporaria unica: ${SENHA}\n`);
  console.log('role         | loja            | cargo       | email');
  for (const p of plan)
    console.log(`${p.role.padEnd(12)} | ${String(p.loja ?? '-').padEnd(15)} | ${String(p.cargo).padEnd(11)} | ${p.email}`);
  console.log(`\nDry-run. Rode com "run" para aplicar (apaga os logins atuais primeiro).`);
}

async function run() {
  const plan = buildPlan(await getColaboradores());
  // 1) backup do estado atual
  const before = await listAllAuthUsers();
  const { data: rolesBefore } = await sb.from('user_roles').select('*');
  const backupPath = join(root, 'scripts', 'acessos-backup.json');
  writeFileSync(backupPath, JSON.stringify({ authUsers: before.map(u => ({ id: u.id, email: u.email })), userRoles: rolesBefore }, null, 2));
  console.log(`backup: ${before.length} auth users + ${rolesBefore?.length ?? 0} user_roles -> ${backupPath}`);

  // 2) wipe
  await sb.from('user_roles').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
  for (const u of before) await sb.auth.admin.deleteUser(u.id);
  console.log(`wipe: ${before.length} auth users removidos`);

  // 3) criar
  const report = [];
  for (const p of plan) {
    const { data, error } = await sb.auth.admin.createUser({ email: p.email, password: SENHA, email_confirm: true });
    if (error) { console.log(`✗ ${p.email}: ${error.message}`); continue; }
    const { error: re } = await sb.from('user_roles').insert({ user_id: data.user.id, role: p.role, colaborador_id: p.colaborador_id });
    if (re) { console.log(`✗ user_roles ${p.email}: ${re.message}`); continue; }
    report.push({ email: p.email, senha: SENHA, role: p.role, nome: p.nome, loja: p.loja, cargo: p.cargo });
  }
  const reportPath = join(root, 'scripts', 'acessos-credenciais.csv');
  writeFileSync(reportPath, 'email,senha,role,nome,loja,cargo\n' + report.map(r => `${r.email},${r.senha},${r.role},"${r.nome}",${r.loja ?? ''},${r.cargo}`).join('\n') + '\n');
  console.log(`\n✓ ${report.length} logins criados. Credenciais -> ${reportPath}`);
}

const cmd = process.argv[2];
if (cmd === 'run') await run();
else await dry();

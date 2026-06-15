// Configura os acessos: 1 admin + 1 login por colaborador, vinculado ao colaborador_id.
// Email gerado (slug-nome.slug-loja@dominio), senha INDIVIDUAL aleatoria.
// Uso: node scripts/setup-acessos.mjs dry   -> mostra o plano (nao aplica)
//      node scripts/setup-acessos.mjs run   -> update-or-create senhas + relatorio CSV + TXT
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
  })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const DOMINIO = 'lidercelulares.local';
const ADMIN_EMAIL = `admin@${DOMINIO}`;
const PAINEL = 'https://lider-celulares.vercel.app';

const ALFA = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genSenha = () => Array.from({ length: 10 }, () => ALFA[randomInt(ALFA.length)]).join('') + '@';
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '.');

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
    email: mkEmail(c.nome, c.loja_id), senha: genSenha(),
  }));
  plan.unshift({ nome: 'ADMINISTRADOR', loja: null, cargo: 'Admin', colaborador_id: null, role: 'admin', email: ADMIN_EMAIL, senha: genSenha() });
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
    if (data.users.length < 1000) break; page++;
  }
  return all;
}

const NIVEL = {
  admin: { titulo: 'ADMINISTRADOR — acesso TOTAL (todas as lojas, relatorios, colaboradores, configuracoes)', ordem: 1 },
  supervisao: { titulo: 'SUPERVISAO — acesso total aos dados (sem gestao de colaboradores/config)', ordem: 2 },
  colaborador: { titulo: 'VENDEDORES / GERENTES / VR / TRAINEE — acesso LIMITADO', ordem: 3 },
};

function buildTxt(plan) {
  const linhas = [];
  linhas.push('ACESSOS — LIDER CELULARES');
  linhas.push(`Gerado em 2026-06-15  |  Painel: ${PAINEL}`);
  linhas.push('Senhas individuais. Troque no primeiro acesso. Distribua por canal seguro.');
  linhas.push('='.repeat(72));
  for (const role of ['admin', 'supervisao', 'colaborador']) {
    const grupo = plan.filter(p => p.role === role);
    if (!grupo.length) continue;
    linhas.push('');
    linhas.push('### ' + NIVEL[role].titulo);
    if (role === 'colaborador') linhas.push('    (vendedor ve SOMENTE os proprios dados; gerente ve a propria loja)');
    linhas.push('');
    let lojaAtual = null;
    for (const p of grupo.sort((a, b) => `${a.loja}${a.cargo}`.localeCompare(`${b.loja}${b.cargo}`))) {
      if (role === 'colaborador' && p.loja !== lojaAtual) { lojaAtual = p.loja; linhas.push(`  -- Loja: ${p.loja} --`); }
      linhas.push(`  ${p.cargo.padEnd(10)} ${(p.nome || '').padEnd(22)} ${p.email.padEnd(42)} senha: ${p.senha}`);
    }
  }
  linhas.push('');
  linhas.push('='.repeat(72));
  return linhas.join('\n') + '\n';
}

async function dry() {
  const plan = buildPlan(await getColaboradores());
  console.log(buildTxt(plan));
  console.log('Dry-run. Rode com "run" para aplicar.');
}

async function run() {
  const plan = buildPlan(await getColaboradores());
  const before = await listAllAuthUsers();
  const byEmail = new Map(before.map(u => [u.email, u]));
  writeFileSync(join(root, 'scripts', 'acessos-backup.json'),
    JSON.stringify({ authUsers: before.map(u => ({ id: u.id, email: u.email })) }, null, 2));

  for (const p of plan) {
    const existing = byEmail.get(p.email);
    if (existing) {
      // login ja existe com role correto (rodada anterior): so atualiza a senha
      const { error } = await sb.auth.admin.updateUserById(existing.id, { password: p.senha });
      if (error) { console.log(`✗ update ${p.email}: ${error.message}`); continue; }
    } else {
      const { data, error } = await sb.auth.admin.createUser({ email: p.email, password: p.senha, email_confirm: true });
      if (error) { console.log(`✗ create ${p.email}: ${error.message}`); continue; }
      const { error: re } = await sb.from('user_roles').insert({ user_id: data.user.id, role: p.role, colaborador_id: p.colaborador_id });
      if (re) console.log(`✗ user_roles ${p.email}: ${re.message}`);
    }
  }

  writeFileSync(join(root, 'scripts', 'acessos-credenciais.csv'),
    'email,senha,role,nome,loja,cargo\n' + plan.map(p => `${p.email},${p.senha},${p.role},"${p.nome}",${p.loja ?? ''},${p.cargo}`).join('\n') + '\n');
  const txtPath = join(root, 'scripts', 'ACESSOS-LIDER.txt');
  writeFileSync(txtPath, buildTxt(plan));
  console.log(`✓ ${plan.length} acessos configurados. Lista -> ${txtPath}`);
}

const cmd = process.argv[2];
if (cmd === 'run') await run();
else await dry();

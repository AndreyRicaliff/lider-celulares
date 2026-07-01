import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const URL_ = env.VITE_SUPABASE_URL;
const SR = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SR, Authorization: `Bearer ${SR}` };

const norm = t => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

async function pageAll(path) {
  const out = [];
  let from = 0; const step = 1000;
  for (;;) {
    const res = await fetch(`${URL_}/rest/v1/${path}`, { headers: { ...H, Range: `${from}-${from + step - 1}` } });
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    out.push(...rows);
    if (rows.length < step) break;
    from += step;
  }
  return out;
}

const MES = process.env.MES || '2026-06';
const [ano, mesN] = MES.split('-');

// 1) audit cru do mês
const audit = await pageAll(`atendimentos_audit?select=loja_id,detalhes_brutos,mes&mes=eq.${MES}`);

// agregação: grupo cru -> {valor, qtd} por loja
const porLoja = {};
const gruposGlobais = {};
for (const row of audit) {
  const loja = row.loja_id;
  porLoja[loja] ??= {};
  const info = Array.isArray(row.detalhes_brutos) ? row.detalhes_brutos : [];
  for (const at of info) {
    for (const bloco of ['Venda', 'Brinde', 'Troca']) {
      for (const item of at[bloco] || []) {
        const g = norm(item.Grupo);
        const v = Number(String(item['Valor de venda'] ?? item.Valor ?? 0).replace(',', '.')) || 0;
        if (v <= 0) continue;
        porLoja[loja][g] ??= { valor: 0, qtd: 0 };
        porLoja[loja][g].valor += v; porLoja[loja][g].qtd += 1;
        gruposGlobais[g] ??= { valor: 0, qtd: 0 };
        gruposGlobais[g].valor += v; gruposGlobais[g].qtd += 1;
      }
    }
  }
}

const fmt = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const isBonif = g => g.includes('BONIFICADO') || g === 'ANATEL';

console.log(`\n===== GRUPOS CRUS DO TENFRONT — ${MES} (audit) =====`);
console.log(`atendimentos-mes lidos: ${audit.length}\n`);

console.log('--- BONIFICAÇÕES por loja (grupo do ERP) ---');
for (const [loja, grupos] of Object.entries(porLoja)) {
  const bon = Object.entries(grupos).filter(([g]) => isBonif(g)).sort((a, b) => b[1].valor - a[1].valor);
  if (bon.length === 0) continue;
  console.log(`\n[${loja}]`);
  for (const [g, d] of bon) console.log(`  ${g.padEnd(20)} R$ ${fmt(d.valor).padStart(14)}  (${d.qtd} itens)`);
}

console.log('\n\n--- TODOS os grupos crus (global, ordenado) ---');
for (const [g, d] of Object.entries(gruposGlobais).sort((a, b) => b[1].valor - a[1].valor)) {
  console.log(`  ${(g || '∅ (vazio)').padEnd(22)} R$ ${fmt(d.valor).padStart(14)}  (${d.qtd})`);
}

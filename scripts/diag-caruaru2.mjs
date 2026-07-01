import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const URL_ = env.VITE_SUPABASE_URL;
const SR = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SR, Authorization: `Bearer ${SR}` };
const j = async p => (await fetch(`${URL_}/rest/v1/${p}`, { headers: H })).json();

// 1) atendimentos por mes das duas lojas
for (const loja of ['caruaru', 'caruaru-2']) {
  const rows = await j(`atendimentos_audit?select=mes,vendedor_nome&loja_id=eq.${loja}`);
  const porMes = {}; const vend = {};
  rows.forEach(r => { porMes[r.mes] = (porMes[r.mes] || 0) + 1; vend[r.vendedor_nome] = (vend[r.vendedor_nome] || 0) + 1; });
  console.log(`\n=== ${loja} — audit ${rows.length} atendimentos ===`);
  console.log('  por mes:', porMes);
  console.log('  vendedores:', Object.entries(vend).map(([k, v]) => `${k}(${v})`).join(', ') || '(nenhum)');
}

// 2) existe registro de loja para as duas?
const lojas = await j(`lojas?select=id,nome,tenfront_consumer_key`);
console.log('\n=== tabela lojas ===');
lojas.forEach(l => console.log(`  ${l.id.padEnd(16)} nome="${l.nome}" cred=${l.tenfront_consumer_key ? 'sim' : 'NÃO'}`));

// 3) config das duas
const cfg = await j(`configuracoes?select=loja_id,mes&loja_id=in.(caruaru,caruaru-2)&order=mes`);
console.log('\n=== configuracoes ===');
console.log('  ', cfg.map(c => `${c.loja_id} ${c.mes}`).join(' | ') || '(nenhuma)');

// 4) vendas (tabela final) das duas
for (const loja of ['caruaru', 'caruaru-2']) {
  const v = await j(`vendas?select=mes&loja_id=eq.${loja}`);
  const pm = {}; v.forEach(x => pm[x.mes] = (pm[x.mes] || 0) + 1);
  console.log(`\n=== vendas ${loja}: ${v.length} linhas`, pm);
}

// 5) colaborador_lojas vinculados
const cl = await j(`colaborador_lojas?select=loja_id,cargo&loja_id=in.(caruaru,caruaru-2)`);
const clm = {}; cl.forEach(x => { clm[x.loja_id] = (clm[x.loja_id] || 0) + 1; });
console.log('\n=== colaborador_lojas vinculados ===', clm);

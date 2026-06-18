// Dispara force-sync por loja (código novo: recompute + remoção de órfãos + custo)
// e verifica o resultado contra os números oficiais do Tenfront. Não deleta nada.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const URL = env.VITE_SUPABASE_URL, ANON = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const sb = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const f = n => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const mes = '2026-06';
const LOJAS = ['soledade', 'monteiro', 'caruaru', 'natal', 'campina-grande'];
const OFICIAL = { natal: { fat: 273593.28, pv: 258718.91, custo: 151604.47 }, 'campina-grande': { fat: 102628.28, pv: 85301.95, custo: 60150.10 }, caruaru: { fat: 84844.67, pv: 75833.01, custo: 48715.60 }, soledade: { fat: 30318.43, pv: 29269.74, custo: 16282.52 }, monteiro: { fat: 34574.42, pv: 32723.94, custo: 19008.88 } };

for (const loja of LOJAS) {
  process.stdout.write(`\n[${loja}] force-sync... `);
  const res = await fetch(`${URL}/functions/v1/sync-tenfront`, { method: 'POST', headers: { Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ force: true, loja_id: loja, mes }) });
  const txt = (await res.text()).slice(0, 200);
  process.stdout.write(`${res.status}\n`);
  const { data } = await sb.from('vendas_diarias').select('valor_total,valor_bruto,custo').eq('loja_id', loja).eq('mes', mes);
  const liq = (data || []).reduce((s, r) => s + (+r.valor_total || 0), 0);
  const fat = (data || []).reduce((s, r) => s + (+r.valor_bruto || 0), 0);
  const cus = (data || []).reduce((s, r) => s + (+r.custo || 0), 0);
  const o = OFICIAL[loja];
  const d = (c, of) => Math.abs(c - of) < 1 ? '✓' : `Δ${f(c - of)}`;
  console.log(`  Líquido(②)=${f(liq)} ${d(liq, o.pv)} | Faturamento(①)=${f(fat)} ${d(fat, o.fat)} | Custo=${f(cus)} ${d(cus, o.custo)} | Lucro=${f(liq - cus)} Margem=${liq > 0 ? ((liq - cus) / liq * 100).toFixed(1) : 0}%`);
}

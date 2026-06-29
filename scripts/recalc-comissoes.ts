// Recálculo de comissões headless via service_role — reusa a lógica REAL do app
// (calculateCommissionsForLoja), sem reimplementar nada (zero drift).
// Rodado por GitHub Action (cron). Mês corrente + anterior.
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// O client singleton (importado transitivamente pelo calc) usa storage: localStorage
// no construtor — shim mínimo pra não quebrar fora do browser.
const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = String(v); },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { for (const k in store) delete store[k]; },
  key: (i: number) => Object.keys(store)[i] ?? null,
  get length() { return Object.keys(store).length; },
} as Storage;

const URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? 'https://ibpcexyrxwmknrfwifyy.supabase.co';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE) { console.error('falta SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const client = createClient<Database>(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { calculateCommissionsForLoja } = await import('@/lib/batchCalculateCommissions');
const { LOJAS_IDS } = await import('@/lib/constants');

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const now = new Date();
const meses = process.env.MESES?.split(',')
  ?? [ym(new Date(now.getFullYear(), now.getMonth() - 1, 1)), ym(now)];

let falhas = 0;
for (const mes of meses) {
  let total = 0;
  for (const loja of LOJAS_IDS) {
    try {
      const r = await calculateCommissionsForLoja(loja, mes, client);
      total += r.count;
      if (r.error && !r.error.includes('config não encontrada')) {
        console.log(`  aviso ${mes} ${loja}: ${r.error}`);
      }
    } catch (e) {
      falhas++;
      console.error(`  ERRO ${mes} ${loja}: ${(e as Error).message}`);
    }
  }
  console.log(`== ${mes}: ${total} folhas ==`);
}
process.exit(falhas > 0 ? 1 : 0);

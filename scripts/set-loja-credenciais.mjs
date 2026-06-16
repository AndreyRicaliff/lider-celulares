// Atualiza as credenciais Tenfront de uma loja via service_role (operação administrativa).
// Substitui a edição de credenciais que ficava exposta no app.
// Uso: node scripts/set-loja-credenciais.mjs <loja_id> <bearer> <consumerKey> <consumerSecret>
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

const [lojaId, bearer, consumerKey, consumerSecret] = process.argv.slice(2);
if (!lojaId || !bearer || !consumerKey || !consumerSecret) {
  console.log('uso: node scripts/set-loja-credenciais.mjs <loja_id> <bearer> <consumerKey> <consumerSecret>');
  process.exit(1);
}

const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { error } = await sb.from('lojas').update({
  tenfront_bearer_token: bearer,
  tenfront_consumer_key: consumerKey,
  tenfront_consumer_secret: consumerSecret,
}).eq('id', lojaId);

if (error) { console.error('✗ erro:', error.message); process.exit(1); }
console.log(`✓ credenciais Tenfront atualizadas para a loja ${lojaId}`);

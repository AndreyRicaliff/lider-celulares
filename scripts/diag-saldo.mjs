import { readFileSync } from 'node:fs';
const env=Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')];}));
const URL=env.VITE_SUPABASE_URL,SR=env.SUPABASE_SERVICE_ROLE_KEY,h={apikey:SR,Authorization:`Bearer ${SR}`};
const SALDO='https://api.tenfront.com.br/v1/saldo-token';
const r=await fetch(`${URL}/rest/v1/lojas?select=id,nome,tenfront_bearer_token,tenfront_consumer_key,tenfront_consumer_secret`,{headers:h});
const lojas=await r.json();
console.log('=== SALDO DIÁRIO TENFRONT (req restantes hoje) ===');
for(const l of lojas){
  if(!l.tenfront_consumer_key){console.log(`  ${l.id.padEnd(16)} sem chave configurada`);continue;}
  const tok=(l.tenfront_bearer_token||'').replace(/^Bearer /,'');
  try{
    const u=`${SALDO}?Consumer-key=${encodeURIComponent(l.tenfront_consumer_key)}&Consumer-secret=${encodeURIComponent(l.tenfront_consumer_secret)}`;
    const res=await fetch(u,{headers:{Authorization:`Bearer ${tok}`}});
    const txt=await res.text();let d;try{d=JSON.parse(txt);}catch{d=null;}
    const raw=d?.response?.['Saldo diário restante']??d?.response?.saldo??null;
    console.log(`  ${l.id.padEnd(16)} HTTP ${res.status}  saldo=${raw??'?'}  ${raw===null?('| '+txt.slice(0,80)):''}`);
  }catch(e){console.log(`  ${l.id.padEnd(16)} ERRO ${e.message}`);}
}

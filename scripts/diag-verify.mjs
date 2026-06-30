import { readFileSync } from 'node:fs';
const env=Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')];}));
const URL=env.VITE_SUPABASE_URL,SR=env.SUPABASE_SERVICE_ROLE_KEY,h={apikey:SR,Authorization:`Bearer ${SR}`};
let rows=[],from=0;
for(;;){const r=await fetch(`${URL}/rest/v1/vendas?select=loja_id,mes,vendedor_nome,detalhes`,{headers:{...h,Range:`${from}-${from+999}`}});const b=await r.json();if(!b.length)break;rows.push(...b);if(b.length<1000)break;from+=1000;}
const cat={};const acc=(k,v)=>cat[k]=(cat[k]||0)+v;
let joao=null;
for(const r of rows){const d=typeof r.detalhes==='string'?JSON.parse(r.detalhes):(r.detalhes||{});
  for(const[k,v]of Object.entries(d)){if(k.startsWith('__'))continue;acc(k,Number(v)||0);}
  if(r.loja_id==='soledade'&&r.mes==='2026-06'&&(r.vendedor_nome||'').toUpperCase().includes('JOÃO'))joao={...d};}
// previsão NEW (do diff todos os meses)
const prev={'BONIFICADO LC':2829693,'SUPER BONIFICADO':538901,'ANATEL':15450,'GERAL':270465,'ACESSÓRIOS':52294,'CASES':13198,'PELÍCULA':123339,'PROTEÇÃO LÍDER':227693,'GARANTIA ESTENDIDA':111459,'ASSISTÊNCIA TÉCNICA':1745};
console.log('=== TOTAIS REAIS (vendas, pós-remap) vs PREVISÃO NEW ===');
for(const k of Object.keys(prev).sort()){const real=cat[k]||0;const p=prev[k];const d=real-p;console.log(`${k.padEnd(20)} real ${real.toFixed(0).padStart(10)}  prev ${p.toString().padStart(10)}  ${Math.abs(d)>50?('Δ '+d.toFixed(0)):'✓'}`);}
console.log('\n=== JOÃO soledade jun (vs Tenfront BLC 23739.92 / SB 3369.99) ===');
if(joao)console.log(`  BLC=${(joao['BONIFICADO LC']||0).toFixed(2)} | SB=${(joao['SUPER BONIFICADO']||0).toFixed(2)} | ANATEL=${(joao['ANATEL']||0).toFixed(2)} | ASSIST=${(joao['ASSISTÊNCIA TÉCNICA']||0).toFixed(2)}`);
else console.log('  João não encontrado');

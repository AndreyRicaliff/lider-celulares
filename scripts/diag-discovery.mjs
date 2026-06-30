import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const env=Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')];}));
const URL=env.VITE_SUPABASE_URL,SR=env.SUPABASE_SERVICE_ROLE_KEY,h={apikey:SR,Authorization:`Bearer ${SR}`};
let rows=[],from=0;
for(;;){const r=await fetch(`${URL}/rest/v1/atendimentos_audit?select=loja_id,mes,detalhes_brutos`,{headers:{...h,Range:`${from}-${from+999}`}});const b=await r.json();if(!b.length)break;rows.push(...b);if(b.length<1000)break;from+=1000;}
const U=t=>(t||'∅').toUpperCase().trim();
// loja -> grupo -> {tipos:Set, n, val, samples:Set}
const D={}, meses=new Set();
for(const a of rows){meses.add(a.mes);const loja=a.loja_id||'?';(D[loja]??={});
  const det=Array.isArray(a.detalhes_brutos)?a.detalhes_brutos:[];
  for(const info of det)for(const arr of[info.Venda||[],info.Brinde||[],info.Troca||[]])for(const it of arr){
    const v=parseFloat(String(it['Valor de venda']??it.Valor??0).replace(',','.'))||0;if(v<=0)continue;
    const g=U(it.Grupo);const o=D[loja][g]??={tipos:new Set(),sub:new Set(),n:0,val:0,samples:new Set()};
    o.tipos.add(U(it['Tipo produto']));o.sub.add(U(it.Subtipo));o.n++;o.val+=v;
    if(o.samples.size<3)o.samples.add((it.Produto||'').slice(0,40));}}
let md=`# Discovery de Grupos por Loja (chave API Tenfront)\n\nMeses no audit: ${[...meses].sort().join(', ')}  •  ${rows.length} atendimentos\n\n`;
const allGrupos=new Set();
for(const loja of Object.keys(D).sort()){
  md+=`## ${loja}\n\n| Grupo (ERP) | itens | R$ | Tipo produto | exemplos |\n|---|---:|---:|---|---|\n`;
  for(const[g,o]of Object.entries(D[loja]).sort((a,b)=>b[1].val-a[1].val)){allGrupos.add(g);
    md+=`| \`${g}\` | ${o.n} | ${o.val.toFixed(2)} | ${[...o.tipos].join(', ')} | ${[...o.samples].slice(0,2).join(' / ')} |\n`;}
  md+=`\n`;}
md+=`## Universo de Grupos (todas as lojas)\n\n`;
[...allGrupos].sort().forEach(g=>md+=`- \`${g}\`\n`);
mkdirSync('docs',{recursive:true});writeFileSync('docs/DISCOVERY_GRUPOS.md',md);
// também imprime resumo no console
console.log(`audit: ${rows.length} atend • meses: ${[...meses].sort().join(',')}`);
for(const loja of Object.keys(D).sort()){console.log(`\n### ${loja}`);
  for(const[g,o]of Object.entries(D[loja]).sort((a,b)=>b[1].val-a[1].val))
    console.log(`  ${o.n.toString().padStart(4)} R$${o.val.toFixed(2).padStart(11)}  [${g}]  tipo:{${[...o.tipos].join('|')}}`);}
console.log(`\nUNIVERSO GRUPOS: ${[...allGrupos].sort().map(g=>`[${g}]`).join(' ')}`);
console.log('\n→ docs/DISCOVERY_GRUPOS.md gravado');

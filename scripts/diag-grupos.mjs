import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')];}));
const URL=env.VITE_SUPABASE_URL, SR=env.SUPABASE_SERVICE_ROLE_KEY;
const h={apikey:SR,Authorization:`Bearer ${SR}`};
let rows=[], from=0;
for(;;){
  const r=await fetch(`${URL}/rest/v1/atendimentos_audit?mes=eq.2026-06&select=loja_id,detalhes_brutos`,{headers:{...h,Range:`${from}-${from+999}`}});
  const b=await r.json(); if(!b.length) break; rows.push(...b); if(b.length<1000) break; from+=1000;
}
const grupos=new Map(), pairGT=new Map();
const add=(m,k,v)=>{const o=m.get(k)||{n:0,val:0};o.n++;o.val+=v;m.set(k,o);};
for(const a of rows){
  const det=Array.isArray(a.detalhes_brutos)?a.detalhes_brutos:[];
  for(const info of det){
    for(const arr of [info.Venda||[], info.Brinde||[], info.Troca||[]]){
      for(const it of arr){
        const v=parseFloat(String(it['Valor de venda']??it.Valor??0).replace(',','.'))||0;
        if(v<=0) continue;
        const g=(it.Grupo||'∅').toUpperCase().trim();
        const t=(it['Tipo produto']||'∅').toUpperCase().trim();
        add(grupos, g, v);
        add(pairGT, `${g}  ||  tipo=${t}`, v);
      }
    }
  }
}
const dump=(m,t,lim=99)=>{console.log(`\n=== ${t} ===`);[...m.entries()].sort((a,b)=>b[1].val-a[1].val).slice(0,lim).forEach(([k,o])=>console.log(`${o.n.toString().padStart(5)}  R$ ${o.val.toFixed(2).padStart(12)}  ${k}`));};
console.log(`audit rows jun: ${rows.length}`);
dump(grupos,'GRUPO (campo ERP) — fonte da verdade');
dump(pairGT,'GRUPO × TIPO',40);

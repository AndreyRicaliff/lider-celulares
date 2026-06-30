import { readFileSync } from 'node:fs';
const env=Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')];}));
const URL=env.VITE_SUPABASE_URL,SR=env.SUPABASE_SERVICE_ROLE_KEY,h={apikey:SR,Authorization:`Bearer ${SR}`};
const norm=t=>(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const classifyServico=p=>{p=norm(p);if(p.includes('protec')||p.includes('proteca')||p.includes('blindagem'))return'PROTEÇÃO LÍDER';if(p.includes('garantia'))return'GARANTIA ESTENDIDA';if(p.includes('manuten')||p.includes('assist')||p.includes('bat iphone')||p.includes('telas diversas'))return'ASSISTÊNCIA TÉCNICA';return'SERVIÇOS';};
const cs=(produto,valor=0)=>{const l=norm(produto);if(l.includes('super bonificado')||l.includes('superbonificado'))return'SUPER BONIFICADO';if(l.includes('infinix')||l.includes('infnix')){if(valor===900)return'BONIFICADO LC';return'SUPER BONIFICADO';}if(l.includes('bonificado lc')||l.includes('bonificado'))return'BONIFICADO LC';if(l.includes('redmi pad'))return'BONIFICADO LC';if(l.includes('iphone')||l.includes('galaxy')||l.includes('motorola')||l.includes('xiaomi')||l.includes('realme')||l.includes('infinix')){if(valor>=1000)return'BONIFICADO LC';}if(valor>=2500)return'SUPER BONIFICADO';if(valor>=900)return'BONIFICADO LC';return'ANATEL';};
const NEW=(grupo,produto,tipo='',subtipo='',valor=0)=>{const g=norm(grupo),t=norm(tipo),s=norm(subtipo),p=norm(produto);
  if(g.includes('super bonificado')||g.includes('superbonificado'))return'SUPER BONIFICADO';
  if(g.includes('bonificado'))return'BONIFICADO LC';if(g==='anatel')return'ANATEL';
  if(g.includes('pelicula'))return'PELÍCULA';if(g.includes('case')||g.includes('capinha'))return'CASES';
  if(g.includes('servico'))return classifyServico(produto);if(g.includes('acessorio'))return'ACESSÓRIOS';
  if(g.includes('jbl')||g.includes('caixa')||g.includes(' som')||p.includes('jbl')||p.includes('boombox')||p.includes('party box'))return'GERAL';
  if(p.includes('(geral)'))return'GERAL';if(g.includes('geral')||g.includes('vendas gerais')||g.includes('outros'))return'GERAL';
  if(p.includes('super bonificado')||p.includes('superbonificado'))return'SUPER BONIFICADO';if(p.includes('bonificado'))return'BONIFICADO LC';if(p.includes('redmi pad'))return'BONIFICADO LC';
  if(g.includes('celular')||t.includes('celular')||t.includes('smartphone')||t.includes('iphone')||t.includes('dispositivo'))return cs(produto,valor);
  if(p.includes('protec')||p.includes('proteca')||p.includes('blindagem')||s.includes('protecao'))return'PROTEÇÃO LÍDER';
  if(p.includes('garantia')||s.includes('garantia'))return'GARANTIA ESTENDIDA';
  if(t.includes('manuten')||t.includes('peca')||t.includes('servico')||t.includes('assistencia'))return classifyServico(produto);
  if(p.includes('pelicula')||p.includes('hidrogel')||p.includes('tpu')||p.includes('privacida')||p.includes('filme')||p.includes('ceramica')||p.includes('vidro'))return'PELÍCULA';
  if(p.includes('capa'))return'CASES';if(t.includes('acessorio')||s.includes('acessorio'))return'ACESSÓRIOS';
  if(valor>0&&valor<500)return'ACESSÓRIOS';if(valor>=900)return cs(produto,valor);return'GERAL';};
const pull=async(tbl,sel)=>{let r=[],f=0;for(;;){const x=await(await fetch(`${URL}/rest/v1/${tbl}?select=${sel}`,{headers:{...h,Range:`${f}-${f+999}`}})).json();if(!x.length)break;r.push(...x);if(x.length<1000)break;f+=1000;}return r;};
const aud=await pull('atendimentos_audit','status,detalhes_brutos');
const ven=await pull('vendas','detalhes');
const expect={},real={};const A=(o,k,v)=>o[k]=(o[k]||0)+v;
for(const a of aud){const st=(a.status||'').toLowerCase();if(st.includes('cancel')||st.includes('exclu'))continue;
  for(const info of(Array.isArray(a.detalhes_brutos)?a.detalhes_brutos:[]))for(const arr of[info.Venda||[],info.Brinde||[],info.Troca||[]])for(const it of arr){const v=parseFloat(String(it['Valor de venda']??it.Valor??0).replace(',','.'))||0;if(v<=0)continue;A(expect,NEW(it.Grupo||'',it.Produto||'',it['Tipo produto']||'',it.Subtipo||'',v),v);}}
for(const r of ven){const d=typeof r.detalhes==='string'?JSON.parse(r.detalhes):(r.detalhes||{});for(const[k,v]of Object.entries(d)){if(k.startsWith('__'))continue;A(real,k,Number(v)||0);}}
console.log('=== vendas (real) vs audit-sem-cancelado+NEW (esperado) ===');
const ks=[...new Set([...Object.keys(expect),...Object.keys(real)])].filter(k=>!k.startsWith('__juros')&&!k.startsWith('__')).sort();
let okAll=true;
for(const k of ks){const e=expect[k]||0,rr=real[k]||0,d=rr-e;const ok=Math.abs(d)<1;if(!ok)okAll=false;console.log(`${k.padEnd(20)} real ${rr.toFixed(0).padStart(10)}  esper ${e.toFixed(0).padStart(10)}  ${ok?'✓':('Δ '+d.toFixed(2))}`);}
console.log(okAll?'\n✅ vendas == audit(sem cancel)+NEW — remap íntegro':'\n⚠ divergências acima (juros/brinde podem explicar pequenas)');

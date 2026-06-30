import { readFileSync } from 'node:fs';
const env=Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')];}));
const URL=env.VITE_SUPABASE_URL,SR=env.SUPABASE_SERVICE_ROLE_KEY,h={apikey:SR,Authorization:`Bearer ${SR}`};
const norm=t=>(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const classifyServico=(produto)=>{const p=norm(produto);
  if(p.includes('protec')||p.includes('proteca')||p.includes('blindagem'))return'PROTEÇÃO LÍDER';
  if(p.includes('garantia'))return'GARANTIA ESTENDIDA';
  if(p.includes('manuten')||p.includes('assist')||p.includes('bat iphone')||p.includes('telas diversas')||p.includes('frontal')||p.includes('tela')||p.includes('bateria')||p.includes('conector')||p.includes('flex'))return'ASSISTÊNCIA TÉCNICA';
  return'SERVIÇOS';};
// classifySmartphone IDÊNTICA à atual (preserva histórico)
const cs=(produto,valor=0)=>{const lower=norm(produto);
  if(lower.includes('super bonificado')||lower.includes('superbonificado'))return'SUPER BONIFICADO';
  if(lower.includes('infinix')||lower.includes('infnix')){if(valor===900)return'BONIFICADO LC';return'SUPER BONIFICADO';}
  if(lower.includes('bonificado lc')||lower.includes('bonificado'))return'BONIFICADO LC';
  if(lower.includes('redmi pad'))return'BONIFICADO LC';
  if(lower.includes('iphone')||lower.includes('galaxy')||lower.includes('motorola')||lower.includes('xiaomi')||lower.includes('realme')||lower.includes('infinix')){if(valor>=1000)return'BONIFICADO LC';}
  if(valor>=2500)return'SUPER BONIFICADO';if(valor>=900)return'BONIFICADO LC';return'ANATEL';};
// ===== OLD =====
const OLD=(grupo,produto,tipo='',subtipo='',valor=0)=>{const gNorm=norm(grupo),pNorm=norm(produto),sNorm=norm(subtipo),tNorm=norm(tipo);
  if(pNorm.includes('super bonificado')||pNorm.includes('superbonificado')||gNorm.includes('super bonificado')||gNorm.includes('superbonificado'))return'SUPER BONIFICADO';
  if(pNorm.includes('bonificado lc')||pNorm.includes('bonificadolc')||gNorm==='bonificado'||gNorm.includes('bonificado lc')||gNorm.includes('bonificadolc'))return'BONIFICADO LC';
  if(pNorm.includes('redmi pad'))return'BONIFICADO LC';
  const isExplicitGeral=pNorm.includes('(geral)')||(pNorm.includes('geral')&&(pNorm.includes('lacrado')||pNorm.includes('jbl')||gNorm==='geral'||gNorm==='vendas gerais'));
  if(isExplicitGeral)return'GERAL';
  if(tNorm.includes('celular')||tNorm.includes('smartphone')||tNorm.includes('iphone')||tNorm.includes('dispositivo')||gNorm.includes('celulares'))return cs(produto,valor);
  if(pNorm.includes('protec')||pNorm.includes('proteca')||pNorm.includes('blindagem')||gNorm.includes('protecao')||sNorm.includes('protecao'))return'PROTEÇÃO LÍDER';
  if(pNorm.includes('garantia')||gNorm.includes('garantia')||sNorm.includes('garantia'))return'GARANTIA ESTENDIDA';
  if(gNorm.includes('pelicula')||sNorm.includes('pelicula')||pNorm.includes('pelicula')||pNorm.includes('hidrogel')||pNorm.includes('tpu')||pNorm.includes('privacida')||pNorm.includes('filme')||pNorm.includes('ceramica')||pNorm.includes('vidro'))return'PELÍCULA';
  if(gNorm.includes('case')||gNorm.includes('capinha')||gNorm.includes('capa')||sNorm.includes('case')||sNorm.includes('capinha')||sNorm.includes('capa')||pNorm.includes('capa'))return'CASES';
  if(tNorm.includes('servico')||tNorm.includes('assistencia')||tNorm.includes('manutencao')||gNorm.includes('servico')||gNorm.includes('manutencao')||gNorm.includes('assistencia')||sNorm.includes('servico'))return classifyServico(produto);
  if(tNorm.includes('acessorio')||gNorm.includes('acessorio')||sNorm.includes('acessorio'))return'ACESSÓRIOS';
  if(gNorm.includes('geral')||gNorm.includes('vendas gerais')||gNorm.includes('outros')){if(valor>=900)return cs(produto,valor);return'GERAL';}
  if(valor>0&&valor<500)return'ACESSÓRIOS';if(valor>=900)return cs(produto,valor);return'GERAL';};
// ===== NEW (grupo-first; cs idêntica) =====
const NEW=(grupo,produto,tipo='',subtipo='',valor=0)=>{const g=norm(grupo),t=norm(tipo),s=norm(subtipo),p=norm(produto);
  // 1. GRUPO ESPECÍFICO do ERP = verdade
  if(g.includes('super bonificado')||g.includes('superbonificado'))return'SUPER BONIFICADO';
  if(g==='bonificado'||g.includes('bonificado lc')||g.includes('bonificadolc')||g.includes('bonificado'))return'BONIFICADO LC';
  if(g==='anatel')return'ANATEL';
  if(g.includes('pelicula'))return'PELÍCULA';
  if(g.includes('case')||g.includes('capinha'))return'CASES';
  if(g.includes('servico'))return classifyServico(produto);
  if(g.includes('acessorio'))return'ACESSÓRIOS';
  if(g.includes('jbl')||g.includes('caixa')||g.includes(' som')||p.includes('jbl')||p.includes('boombox')||p.includes('party box'))return'GERAL';
  // 1b. marcador (GERAL) no nome OU grupo GERAL (decisão: honrar ERP)
  if(p.includes('(geral)'))return'GERAL';
  if(g.includes('geral')||g.includes('vendas gerais')||g.includes('outros'))return'GERAL';
  // 2. nome bonificado explícito
  if(p.includes('super bonificado')||p.includes('superbonificado'))return'SUPER BONIFICADO';
  if(p.includes('bonificado'))return'BONIFICADO LC';if(p.includes('redmi pad'))return'BONIFICADO LC';
  // 3. CELULARES / dispositivo genérico → heurística (IGUAL OLD)
  if(g.includes('celular')||t.includes('celular')||t.includes('smartphone')||t.includes('iphone')||t.includes('dispositivo'))return cs(produto,valor);
  // 4. serviços/proteção por nome/tipo
  if(p.includes('protec')||p.includes('proteca')||p.includes('blindagem')||s.includes('protecao'))return'PROTEÇÃO LÍDER';
  if(p.includes('garantia')||s.includes('garantia'))return'GARANTIA ESTENDIDA';
  if(t.includes('manuten')||t.includes('peca')||t.includes('servico')||t.includes('assistencia'))return classifyServico(produto);
  if(p.includes('pelicula')||p.includes('hidrogel')||p.includes('tpu')||p.includes('privacida')||p.includes('filme')||p.includes('ceramica')||p.includes('vidro'))return'PELÍCULA';
  if(p.includes('capa'))return'CASES';
  if(t.includes('acessorio')||s.includes('acessorio'))return'ACESSÓRIOS';
  // 5. fallback valor (igual OLD)
  if(valor>0&&valor<500)return'ACESSÓRIOS';if(valor>=900)return cs(produto,valor);return'GERAL';};
let rows=[],from=0;
for(;;){const r=await fetch(`${URL}/rest/v1/atendimentos_audit?select=loja_id,mes,detalhes_brutos`,{headers:{...h,Range:`${from}-${from+999}`}});const b=await r.json();if(!b.length)break;rows.push(...b);if(b.length<1000)break;from+=1000;}
const catOld={},catNew={},changes=[];const acc=(o,k,v)=>o[k]=(o[k]||0)+v;
for(const a of rows){const det=Array.isArray(a.detalhes_brutos)?a.detalhes_brutos:[];
  for(const info of det)for(const arr of[info.Venda||[],info.Brinde||[],info.Troca||[]])for(const it of arr){
    const v=parseFloat(String(it['Valor de venda']??it.Valor??0).replace(',','.'))||0;if(v<=0)continue;
    const args=[it.Grupo||'',it.Produto||'',it['Tipo produto']||'',it.Subtipo||'',v];const o=OLD(...args),n=NEW(...args);acc(catOld,o,v);acc(catNew,n,v);
    if(o!==n)changes.push({loja:a.loja_id,mes:a.mes,g:it.Grupo||'∅',prod:it.Produto,v,o,n});}}
console.log('=== TOTAIS POR CATEGORIA (OLD → NEW, todos os meses) ===');
[...new Set([...Object.keys(catOld),...Object.keys(catNew)])].sort().forEach(c=>{const a=catOld[c]||0,b=catNew[c]||0,d=b-a;console.log(`${c.padEnd(20)} ${a.toFixed(0).padStart(10)} → ${b.toFixed(0).padStart(10)}  ${Math.abs(d)>0.5?('Δ '+d.toFixed(2)):''}`);});
const byMudanca={};changes.forEach(c=>{const k=`${c.o} → ${c.n}`;(byMudanca[k]??={n:0,v:0,ex:new Set()});byMudanca[k].n++;byMudanca[k].v+=c.v;if(byMudanca[k].ex.size<3)byMudanca[k].ex.add(`[${c.g}] ${(c.prod||'').slice(0,30)}`);});
console.log(`\n=== TIPOS DE MUDANÇA (${changes.length} itens) ===`);
Object.entries(byMudanca).sort((a,b)=>b[1].v-a[1].v).forEach(([k,o])=>console.log(`  ${k.padEnd(34)} ${o.n}x  R$${o.v.toFixed(2)}\n     ex: ${[...o.ex].join(' | ')}`));

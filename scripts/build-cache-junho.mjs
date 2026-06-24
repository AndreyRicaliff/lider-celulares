// Baixa o raw de junho/2026 das 5 lojas UMA vez e salva em cache local SEM PII
// (sem Cliente/telefone) para iterar a análise da fórmula offline, sem gastar quota.
// Saída: scripts/_cache-junho.json (gitignored). Uso: node scripts/build-cache-junho.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const lojas = JSON.parse(readFileSync('lojas.json', 'utf8'));
const M = '06', Y = '2026';
const clean = (b) => (b.startsWith('Bearer ') ? b.slice(7) : b);
const VALID = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
const escBs = (r) => { let o = ''; for (let i = 0; i < r.length; i++) { if (r[i] !== '\\') { o += r[i]; continue; } if (VALID.has(r[i + 1])) { o += r[i] + r[i + 1]; i++; continue; } o += '\\\\'; } return o; };
const parse = (t) => { try { return JSON.parse(t); } catch { return JSON.parse(escBs(t)); } };
const noMes = (d) => { const p = (d || '').split(' ')[0].split('/'); return p[1] === M && p[2] === Y; };

// Mantém só o necessário — descarta Cliente/telefone/atendente (PII).
const slim = (a) => ({
  data: a.Data, status: a.Status, tipoVenda: a['Tipo de venda'], intencao: a['Intenção'],
  vendedor: (a.Vendedor || '').trim(),
  totalBruto: a['Total bruto'], totalCustos: a['Total custos'], totalLucro: a['Total lucro'], totalDesconto: a['Total desconto'],
  itens: (a['Informações do atendimento'] || []).flatMap((info) =>
    [...(info.Venda || []).map((v) => ({ ...v, _origem: 'venda' })),
     ...(info.Brinde || []).map((v) => ({ ...v, _origem: 'brinde' })),
     ...(info.Troca || []).map((v) => ({ ...v, _origem: 'troca' }))]
      .map((v) => ({ origem: v._origem, produto: v.Produto, grupo: v.Grupo, tipo: v['Tipo produto'], subtipo: v.Subtipo, qtd: v.Quantidade, desconto: v.Desconto, valorVenda: v['Valor de venda'], custo: v.Custo }))),
  pagamento: (a.Pagamento || []).map((p) => ({ forma: p.Forma, informado: p['Valor informado'], comAcrescimo: p['Valor com acréscimo'] })),
});

const CACHE = 'scripts/_cache-junho.json';
const out = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
for (const l of lojas) {
  if (out[l.id]?.length) { console.log(`${l.id}: já em cache (${out[l.id].length}) — pulando`); continue; }
  const hdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${clean(l.bearer)}`, 'Consumer-key': l.consumerKey, 'Consumer-secret': l.consumerSecret };
  const page = async (p) => parse(await (await fetch('https://api.tenfront.com.br/v1/listar-atendimentos', { method: 'POST', headers: hdr, body: JSON.stringify({ page: String(p), 'data-inicial': `01/${M}/${Y}`, 'data-final': `30/${M}/${Y}` }) })).text());
  const d1 = await page(1);
  const total = Number(d1['Total pages']) || 1;
  let recs = [...(d1.Response || [])];
  for (let p = 2; p <= total; p++) { await new Promise((r) => setTimeout(r, 400)); recs.push(...((await page(p)).Response || [])); }
  out[l.id] = recs.filter((a) => noMes(a.Data)).map(slim);
  writeFileSync(CACHE, JSON.stringify(out)); // incremental: salva após cada loja
  console.log(`${l.id}: ${out[l.id].length} atendimentos de junho cacheados (${total} páginas) [salvo]`);
}
console.log('\n✓ cache completo em scripts/_cache-junho.json (sem PII)');

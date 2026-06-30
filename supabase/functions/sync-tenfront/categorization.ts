// ===== Mapeamento de Grupo da API → categoria interna =====
//
// REGRA DE OURO: o campo `Grupo` do ERP (Tenfront) é a fonte da verdade.
// Grupo ESPECÍFICO (BONIFICADO / SUPER BONIFICADO / ANATEL / PELÍCULAS / CASES /
// ACESSÓRIOS / SERVIÇOS / GERAL) decide a categoria diretamente.
// A heurística por nome/preço (classifySmartphone) só vale para o grupo GENÉRICO
// `CELULARES` e itens sem grupo — nunca sobrescreve um grupo específico.
// Discovery completo por loja em docs/DISCOVERY_GRUPOS.md.

const norm = (txt: string) => (txt || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const classifySmartphone = (produto: string, valor: number = 0): string => {
  const lower = norm(produto);
  if (lower.includes('super bonificado') || lower.includes('superbonificado')) return 'SUPER BONIFICADO';
  if (lower.includes('infinix') || lower.includes('infnix')) {
    if (valor === 900) return 'BONIFICADO LC';
    return 'SUPER BONIFICADO';
  }
  if (lower.includes('bonificado lc') || lower.includes('bonificado')) return 'BONIFICADO LC';
  if (lower.includes('redmi pad')) return 'BONIFICADO LC';
  if (lower.includes('iphone') || lower.includes('galaxy') || lower.includes('motorola') ||
      lower.includes('xiaomi') || lower.includes('realme') || lower.includes('infinix')) {
    if (valor >= 1000) return 'BONIFICADO LC';
  }
  if (valor >= 2500) return 'SUPER BONIFICADO';
  if (valor >= 900) return 'BONIFICADO LC';
  return 'ANATEL';
};

export const classifyServico = (produto: string): string => {
  const p = norm(produto);
  if (p.includes('protec') || p.includes('proteca') || p.includes('blindagem')) return 'PROTEÇÃO LÍDER';
  if (p.includes('garantia')) return 'GARANTIA ESTENDIDA';
  if (p.includes('manuten') || p.includes('assist') || p.includes('bat iphone') || p.includes('telas diversas')) return 'ASSISTÊNCIA TÉCNICA';
  return 'SERVIÇOS';
};

// Grupo explícito do ERP → categoria. Retorna null se o grupo não for conclusivo.
const categoriaPorGrupo = (g: string, p: string, produto: string): string | null => {
  if (g.includes('super bonificado') || g.includes('superbonificado')) return 'SUPER BONIFICADO';
  if (g.includes('bonificado')) return 'BONIFICADO LC';
  if (g === 'anatel') return 'ANATEL';
  if (g.includes('pelicula')) return 'PELÍCULA';
  if (g.includes('case') || g.includes('capinha')) return 'CASES';
  if (g.includes('servico')) return classifyServico(produto);
  if (g.includes('acessorio')) return 'ACESSÓRIOS';
  // Caixas de som (JBL/boombox) não são celular, mesmo com tipo=DISPOSITIVO.
  if (g.includes('jbl') || g.includes('caixa') || g.includes(' som') ||
      p.includes('jbl') || p.includes('boombox') || p.includes('party box')) return 'GERAL';
  // Marcador "(GERAL)" digitado no nome ou grupo GERAL → honra o ERP.
  if (p.includes('(geral)')) return 'GERAL';
  if (g.includes('geral') || g.includes('vendas gerais') || g.includes('outros')) return 'GERAL';
  return null;
};

export const unmappedGroups = new Set<string>();
export const unmappedProducts = new Set<string>();
export const celularesDebug: Array<{ grupo: string; tipo: string; produto: string; categoria: string; valor: number }> = [];

export const mapGrupoToCategory = (grupo: string, produto: string, tipo = '', subtipo = '', valor = 0, _qtd = 1, _lojaIdDebug = ''): string => {
  const g = norm(grupo), p = norm(produto), s = norm(subtipo), t = norm(tipo);

  const porGrupo = categoriaPorGrupo(g, p, produto);
  if (porGrupo) return porGrupo;

  // Nome marcado como bonificado quando o grupo é genérico (ex.: CELULARES).
  if (p.includes('super bonificado') || p.includes('superbonificado')) return 'SUPER BONIFICADO';
  if (p.includes('bonificado')) return 'BONIFICADO LC';
  if (p.includes('redmi pad')) return 'BONIFICADO LC';

  // Grupo genérico CELULARES / dispositivo → heurística nome+preço (único lugar legítimo).
  if (g.includes('celular') || t.includes('celular') || t.includes('smartphone') ||
      t.includes('iphone') || t.includes('dispositivo')) {
    const cat = classifySmartphone(produto, valor);
    celularesDebug.push({ grupo, tipo, produto, categoria: cat, valor });
    return cat;
  }

  if (p.includes('protec') || p.includes('proteca') || p.includes('blindagem') || s.includes('protecao')) return 'PROTEÇÃO LÍDER';
  if (p.includes('garantia') || s.includes('garantia')) return 'GARANTIA ESTENDIDA';
  if (t.includes('manuten') || t.includes('peca') || t.includes('servico') || t.includes('assistencia')) return classifyServico(produto);
  if (p.includes('pelicula') || p.includes('hidrogel') || p.includes('tpu') || p.includes('privacida') ||
      p.includes('filme') || p.includes('ceramica') || p.includes('vidro')) return 'PELÍCULA';
  if (p.includes('capa')) return 'CASES';
  if (t.includes('acessorio') || s.includes('acessorio')) return 'ACESSÓRIOS';

  if (valor > 0 && valor < 500) return 'ACESSÓRIOS';
  if (valor >= 900) return classifySmartphone(produto, valor);

  unmappedGroups.add(g);
  unmappedProducts.add(`${p}|tipo:${t}|val:${valor}`);
  return 'GERAL';
};

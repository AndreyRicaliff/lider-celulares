// Caruaru divide as vendas em 2 lojas (caruaru + caruaru-2) por causa do teto de
// faturamento do shopping (taxa sobre receita acima do limite). São uma operação só.
// O agrupamento é OPT-IN (toggle) e LOCAL à auditoria — não altera o seam global de
// query (getLojaIdsForQuery), pra que no resto do app as lojas continuem separadas.
export const GRUPO_CARUARU = ['caruaru', 'caruaru-2'] as const;

const noGrupoCaruaru = (lojaId: string): boolean =>
  (GRUPO_CARUARU as readonly string[]).includes(lojaId);

// Ids a consultar para uma loja: o grupo inteiro quando agrupando uma loja do grupo Caruaru.
export function idsParaQuery(lojaId: string, agruparCaruaru: boolean): string[] {
  if (agruparCaruaru && noGrupoCaruaru(lojaId)) return [...GRUPO_CARUARU];
  return [lojaId];
}

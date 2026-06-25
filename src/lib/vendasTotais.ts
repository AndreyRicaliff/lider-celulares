import { isIgnoredColumn } from './constants';

// Total de uma venda a partir de `detalhes`: usa "VALOR REAL (S/ JUROS)" quando presente,
// senão soma as colunas de categoria (ignorando derivadas/resumos). Fonte única — antes
// duplicado em HistoricoLojaChart e afins.
export function computeTotalDetalhes(detalhes: Record<string, number> | null | undefined): number {
  const realSemJuros = Number(detalhes?.['VALOR REAL (S/ JUROS)'] || 0);
  if (realSemJuros > 0) return realSemJuros;
  return Object.entries(detalhes || {}).reduce((sum, [k, v]) => {
    if (k !== '_upload_source' && typeof v === 'number' && !isIgnoredColumn(k.toUpperCase())) {
      return sum + v;
    }
    return sum;
  }, 0);
}

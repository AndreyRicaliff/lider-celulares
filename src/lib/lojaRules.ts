export const isLojaSoledadeMonteiro = (lojaId?: string | null): boolean => {
  return lojaId === 'soledade' || lojaId === 'monteiro';
};

export const isLojaNatalLike = (lojaId?: string | null): boolean => {
  return lojaId === 'natal' || lojaId === 'caruaru';
};

export const isLojaCampinaNatal = (lojaId?: string | null): boolean => {
  return lojaId === 'campina-grande' || lojaId === 'natal' || lojaId === 'caruaru';
};

export const isLojaMonteiro = (lojaId?: string | null): boolean => {
  return lojaId === 'monteiro';
};

// caruaru-2 é a 2ª chave Tenfront do MESMO PDV de Caruaru: faturamento fica separado
// (faturamento_loja mantém a linha própria), mas a comissão é fundida na meta única do
// vendedor em Caruaru. LOJA_TERMINAIS = pai → chaves que somam; LOJA_PAI = chave → pai.
const LOJA_TERMINAIS: Record<string, string[]> = { 'caruaru': ['caruaru', 'caruaru-2'] };
const LOJA_PAI: Record<string, string> = { 'caruaru-2': 'caruaru' };

export const mapLojaToSharedBase = (lojaId?: string | null): string | undefined => {
  if (!lojaId) return undefined;
  return LOJA_PAI[lojaId] ?? lojaId;
};

/**
 * Retorna os loja_ids para consulta unificada (funde terminais no PDV pai).
 */
export const getLojaIdsForQuery = (lojaId?: string | null): string[] => {
  if (!lojaId) return [];
  return LOJA_TERMINAIS[lojaId] ?? [lojaId];
};

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

export const mapLojaToSharedBase = (lojaId?: string | null): string | undefined => {
  if (!lojaId) return undefined;
  return lojaId;
};

/**
 * Retorna os loja_ids para consulta unificada.
 */
export const getLojaIdsForQuery = (lojaId?: string | null): string[] => {
  if (!lojaId) return [];
  return [lojaId];
};

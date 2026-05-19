import { isLojaCampinaNatal } from '@/lib/lojaRules';

interface VendaComDetalhes {
  loja_id: string;
  detalhes?: Record<string, unknown> | null;
}

export function computeValForMeta(v: VendaComDetalhes): number {
  const d = (v.detalhes || {}) as Record<string, number>;
  const smVal = (Number(d['BONIFICADO LC']) || 0) + (Number(d['SUPER BONIFICADO']) || 0) + (Number(d['ANATEL']) || 0);
  const accVal = (Number(d['ACESSÓRIOS']) || 0) + (Number(d['CASES']) || 0);
  const pelVal = Number(d['PELÍCULA']) || 0;
  const svcVal = (Number(d['PROTEÇÃO LÍDER']) || 0) + (Number(d['GARANTIA ESTENDIDA']) || 0);
  const atVal = Number(d['ASSISTÊNCIA TÉCNICA']) || 0;
  const gerVal = Number(d['GERAL']) || 0;

  if (v.loja_id === 'soledade') return smVal + accVal + pelVal + atVal + gerVal;
  if (v.loja_id === 'monteiro') return smVal + accVal + pelVal + svcVal + atVal + gerVal;
  if (isLojaCampinaNatal(v.loja_id)) return smVal + svcVal;
  return (Number(d['VALOR REAL (S/ JUROS)']) || 0) || (smVal + accVal + pelVal + atVal + gerVal);
}

import { isIgnoredColumn } from '@/lib/constants';

/**
 * Calcula o total real de vendas a partir dos detalhes, ignorando colunas informativas
 * como TOTAL, VALOR REAL, etc. que causam duplicação se somadas.
 */
export const calcularTotalFromDetalhes = (detalhes: Record<string, unknown>): number => {
  return Object.entries(detalhes || {}).reduce((sum, [key, val]) => {
    if (key === '_upload_source' || typeof val !== 'number' || isIgnoredColumn(key)) return sum;
    return sum + val;
  }, 0);
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
};

export const formatMonth = (mes: string): string => {
  const [year, month] = mes.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

export const getDaysInMonth = (mes: string): number => {
  const [year, month] = mes.split('-').map(Number);
  return new Date(year, month, 0).getDate();
};

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

export const formatNumber = (value: number, decimals = 2): string => {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

export const formatPercent = (value: number): string => {
  return `${formatNumber(value, 1)}%`;
};

export const parseCurrency = (value: string | number): number => {
  if (typeof value === 'number') return value;
  const cleanValue = value
    .replace(/R\$\s?/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  return parseFloat(cleanValue) || 0;
};

export const formatMonth = (mes: string): string => {
  const [year, month] = mes.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

export const formatMonthShort = (mes: string): string => {
  const [year, month] = mes.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
};

export const getCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const getLastMonths = (count: number): { value: string; label: string }[] => {
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      value,
      label: date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
    });
  }
  
  return months;
};

export const getDaysInMonth = (mes: string): number => {
  const [year, month] = mes.split('-').map(Number);
  return new Date(year, month, 0).getDate();
};

export const getCurrentDayOfMonth = (): number => {
  return new Date().getDate();
};

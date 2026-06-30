import type { AtendimentoDetalhe, VendaItem, TabelaPreco } from './types';

const num = (v: unknown): number => Number(v ?? 0) || 0;

export const valorItem = (v: VendaItem): number => num(v['Valor de venda'] ?? v.Valor);

export const isConcluida = (status: string | null): boolean =>
  (status || '').toLowerCase().includes('concl');

export const isCancelada = (status: string | null): boolean =>
  (status || '').toLowerCase().includes('cancel');

// Soma o valor de venda de todos os itens (sem juros) — o "valor real" cru.
export function calcTotalReal(detalhes: AtendimentoDetalhe[] | null): number {
  if (!Array.isArray(detalhes)) return 0;
  return detalhes.reduce(
    (sum, info) => sum + (info.Venda || []).reduce((s, v) => s + valorItem(v), 0),
    0,
  );
}

// Verdadeiro quando o produto foi vendido abaixo do mínimo da tabela de preços.
export function checkAlertaPreco(
  produto: string,
  valor: number,
  lojaId: string,
  tabela: TabelaPreco[],
): boolean {
  if (!produto || valor <= 0) return false;
  const p = produto.toUpperCase();
  const regiao = lojaId === 'natal' || lojaId === 'caruaru' ? 'RN_PE' : 'PB';

  // PRO e nomes mais longos primeiro: evita casar "iPhone 15" com "iPhone 15 Pro".
  const ordenada = [...tabela].sort((a, b) => {
    const aPro = a.modelo.toUpperCase().includes('PRO');
    const bPro = b.modelo.toUpperCase().includes('PRO');
    if (aPro !== bPro) return aPro ? -1 : 1;
    return b.modelo.length - a.modelo.length;
  });

  const match = ordenada.find((t) => {
    if (t.regiao !== regiao) return false;
    const m = t.modelo.toUpperCase();
    const mem = (t.memoria || '').toUpperCase();
    if (!p.includes(m)) return false;
    if (m.includes('PRO') !== p.includes('PRO')) return false;
    if (mem !== '') {
      const tabelaMem = mem.match(/\d+/g) || [];
      const produtoMem = p.match(/\d+/g) || [];
      if (!tabelaMem.every((part) => produtoMem.includes(part))) return false;
    }
    return true;
  });

  if (!match) return false;
  const minPrice = num(match.preco_tabela) - num(match.desconto_livre);
  return valor < minPrice - 0.01;
}

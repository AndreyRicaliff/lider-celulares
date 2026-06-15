import { VENDEDOR_NOME_OVERRIDES, NAME_ALIASES } from './constants.ts';
import { safeParseNumber, normalize, parseDate } from './utils.ts';
import { mapGrupoToCategory } from './categorization.ts';
import type { Atendimento, MappedVenda, ItemCategorizado } from './types.ts';

// ===== Atribuição de juros por categoria =====

export const findMatchingItems = (items: ItemCategorizado[], target: number, eps = 0.10): ItemCategorizado[] => {
  // Tenta match exato de 1 item
  const single = items.find(i => Math.abs(i.valor - target) <= eps);
  if (single) return [single];
  // Soma de todos os itens
  const total = items.reduce((s, i) => s + i.valor, 0);
  if (Math.abs(total - target) <= eps) return items;
  // Pares
  for (let a = 0; a < items.length; a++)
    for (let b = a + 1; b < items.length; b++)
      if (Math.abs(items[a].valor + items[b].valor - target) <= eps) return [items[a], items[b]];
  // Trios
  for (let a = 0; a < items.length; a++)
    for (let b = a + 1; b < items.length; b++)
      for (let c = b + 1; c < items.length; c++)
        if (Math.abs(items[a].valor + items[b].valor + items[c].valor - target) <= eps) return [items[a], items[b], items[c]];
  // Fallback: todos proporcional
  return items;
};

export const computeJurosPorCategoria = (
  pagamentos: any[],
  itensCat: ItemCategorizado[],
): Record<string, number> => {
  const result: Record<string, number> = {};
  if (!pagamentos?.length || !itensCat.length) return result;

  const totalItens = itensCat.reduce((s, i) => s + i.valor, 0);
  if (totalItens <= 0) return result;

  for (const p of pagamentos) {
    const informado = safeParseNumber(p['Valor informado'] || 0);
    const comAcrescimo = safeParseNumber(p['Valor com acréscimo'] || p['Valor informado'] || 0);
    const juros = comAcrescimo - informado;
    if (juros <= 0.01) continue;

    const matching = findMatchingItems(itensCat.filter(i => i.valor > 0), informado);
    const matchTotal = matching.reduce((s, i) => s + i.valor, 0) || totalItens;
    for (const item of matching) {
      const key = `__juros_${item.categoria}`;
      result[key] = (result[key] || 0) + juros * (item.valor / matchTotal);
    }
  }
  return result;
};

// ===== Map atendimento to venda =====

export const mapAtendimentoToVenda = (atendimento: Atendimento & { LojaId?: string }, targetMonth: string): MappedVenda | null => {
  const parsed = parseDate(atendimento.Data);
  if (!parsed) return null;
  if (parsed.month !== targetMonth) return null;

  // Ignorar atendimentos cancelados
  const status = (atendimento.Status || '').trim().toLowerCase();
  if (status.includes('cancel') || status.includes('exclu')) return null;

  const vendedorRaw = (atendimento.Vendedor || '').trim();
  if (!vendedorRaw) return null;

  const normalizedName = normalize(vendedorRaw);
  const vendedorNome = (VENDEDOR_NOME_OVERRIDES[normalizedName] || vendedorRaw).toUpperCase().trim();

  const detalhes: Record<string, number> = {};
  let valorTotal = 0;
  let qtdSmartphones = 0;
  let qtdServicos = 0;

  for (const info of atendimento['Informações do atendimento'] || []) {
    // 1. Processar Vendas
    for (const venda of info.Venda || []) {
      const valorUnitario = safeParseNumber(venda['Valor de venda'] || (venda as any).Valor || 0);
      const qtd = Number(venda.Quantidade) || 1;

      if (atendimento.LojaId === 'natal') {
        console.log(`[NATAL_ITEM] Vendedor: ${vendedorNome} | P: ${venda.Produto} | V: ${valorUnitario} | G: ${venda.Grupo}`);
      }

      // Regra: Se o valor de venda for 0, é considerado brinde e não conta para o total,
      // porém, para fins de meta de Natal, vamos logar para conferir se há algo perdido aqui.
      if (valorUnitario <= 0) {
        if (atendimento.LojaId === 'natal') {
          console.log(`[NATAL_ZERO_VALUE] Atendimento: ${atendimento['ID atendimento']} | Produto: ${venda.Produto} | Vendedor: ${vendedorNome}`);
        }
        continue;
      }

      const categoria = mapGrupoToCategory(
        venda.Grupo || '',
        venda.Produto || '',
        venda['Tipo produto'] || '',
        venda.Subtipo || '',
        valorUnitario,
        qtd,
        (atendimento as any).LojaId || '', // Forçar cast para any para evitar erro de tipo
      );

      detalhes[categoria] = (detalhes[categoria] || 0) + valorUnitario;
      valorTotal += valorUnitario;

      if (categoria === 'BONIFICADO LC' || categoria === 'SUPER BONIFICADO' || categoria === 'ANATEL') {
        qtdSmartphones += qtd;
      } else if (categoria === 'PROTEÇÃO LÍDER' || categoria === 'GARANTIA ESTENDIDA') {
        qtdServicos += qtd;
      }
    }

    // 2. Processar Brindes - Agora incluímos se tiverem valor > 0 (ex: item de R$ 30 que foi ignorado)
    for (const brinde of (info as any).Brinde || []) {
      const valorBrinde = safeParseNumber(brinde['Valor de venda'] || brinde.Valor || 0);
      const qtdB = Number(brinde.Quantidade) || 1;

      if (valorBrinde > 0) {
        const categoria = mapGrupoToCategory(
          brinde.Grupo || '',
          brinde.Produto || '',
          brinde['Tipo produto'] || '',
          brinde.Subtipo || '',
          valorBrinde,
          qtdB,
          (atendimento as any).LojaId || '',
        );
        detalhes[categoria] = (detalhes[categoria] || 0) + valorBrinde;
        valorTotal += valorBrinde;
      }
    }

    // 3. Processar Trocas
    const trocas = (info as any).Troca || [];
    for (const troca of trocas) {
      const valorTroca = safeParseNumber(troca['Valor de venda'] || troca.Valor || 0);
      const qtdT = Number(troca.Quantidade) || 1;

      if (valorTroca !== 0) {
        const categoria = mapGrupoToCategory(
          troca.Grupo || '',
          troca.Produto || '',
          troca['Tipo produto'] || '',
          troca.Subtipo || '',
          valorTroca,
          qtdT,
          (atendimento as any).LojaId || '',
        );
        detalhes[categoria] = (detalhes[categoria] || 0) + valorTroca;
        valorTotal += valorTroca;
      }
    }
  }

  if (qtdSmartphones > 0) detalhes['__qtd_smartphones'] = qtdSmartphones;
  if (qtdServicos > 0) detalhes['__qtd_servicos'] = qtdServicos;

  if (valorTotal <= 0 && qtdSmartphones === 0) return null;

  // Calcular juros por categoria a partir do campo Pagamento
  const itensCat: ItemCategorizado[] = Object.entries(detalhes)
    .filter(([k]) => !k.startsWith('__'))
    .map(([categoria, valor]) => ({ categoria, valor: valor as number }));
  const pagamentos = (atendimento as any).Pagamento || [];
  const jurosPorCategoria = computeJurosPorCategoria(pagamentos, itensCat);
  Object.assign(detalhes, jurosPorCategoria);

  return {
    vendedor_nome: vendedorNome,
    mes: targetMonth,
    data: parsed.isoDate,
    detalhes,
    valor_total: valorTotal,
    valor_bruto: safeParseNumber(atendimento['Total bruto'] || 0),
  };
};

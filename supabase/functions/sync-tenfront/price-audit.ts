// ===== Auditoria de Preços =====

export const checkPriceAlert = (produto: string, valorUnitario: number, tabelaPrecos: any[], lojaId: string): boolean => {
  const p = (produto || '').toUpperCase();
  if (valorUnitario <= 0) return false;

  const regiaoLoja = (lojaId === 'natal' || lojaId === 'caruaru') ? 'RN_PE' : 'PB';

  // Ordenar tabela: versões PRO primeiro para evitar que "REDMI NOTE 13 PRO" bata em "REDMI NOTE 13"
  const sortedTable = [...tabelaPrecos].sort((a, b) => {
    const aUpper = a.modelo.toUpperCase();
    const bUpper = b.modelo.toUpperCase();
    const aHasPro = aUpper.includes('PRO');
    const bHasPro = bUpper.includes('PRO');
    if (aHasPro && !bHasPro) return -1;
    if (!aHasPro && bHasPro) return 1;
    return bUpper.length - aUpper.length; // Nomes mais longos primeiro
  });

  const match = sortedTable.find(t => {
    if (t.regiao !== regiaoLoja) return false;

    const m = (t.modelo || '').toUpperCase();
    const mem = (t.memoria || '').toUpperCase();

    // 1. Verificação de Modelo
    // Se o modelo da tabela é "IPHONE 13", deve bater em "IPHONE 13 128GB PRETO"
    // Mas se o produto é "IPHONE 13 PRO", não deve bater em "IPHONE 13" se houver um "IPHONE 13 PRO" na tabela
    if (!p.includes(m)) return false;

    // Se a tabela pede PRO e o produto não tem, ou vice-versa (proteção extra)
    const tableHasPro = m.includes('PRO');
    const productHasPro = p.includes('PRO');
    if (tableHasPro !== productHasPro) return false;

    // 2. Verificação de Memória (Sincronismo Inteligente)
    if (mem !== '') {
      // Extrair números da memória (ex: "128GB" -> "128", "4GB/128GB" -> ["4", "128"])
      const tableMemParts = mem.match(/\d+/g) || [];
      const productMemParts = p.match(/\d+/g) || [];

      // Se a tabela especifica memória, o produto deve conter esses números
      // Ex: Tabela "128GB", Produto "IPHONE 13 128GB" -> Match
      const allPartsMatch = tableMemParts.every(part => productMemParts.includes(part));
      if (!allPartsMatch) return false;
    }

    return true;
  });

  if (match) {
    const minPrice = Number(match.preco_tabela) - Number(match.desconto_livre || 0);
    return valorUnitario < (minPrice - 0.01); // Pequena margem para evitar erros de arredondamento
  }
  return false;
};

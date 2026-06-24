// ===== Tipos =====

export type AtendimentoVenda = {
  Produto: string;
  'Tipo produto': string;
  Subtipo?: string;
  Grupo: string;
  Marca?: string;
  Quantidade?: number;
  Desconto?: number;
  'Valor de venda': number;
  Custo?: number;
  IMEI?: string;
  Fornecedor?: string;
};

export type Atendimento = {
  Data: string;
  'ID atendimento': string;
  'Informações do atendimento': Array<{ Venda?: AtendimentoVenda[]; Brinde?: unknown[]; Troca?: unknown[] }>;
  Vendedor: string;
  Atendente?: string;
  Status?: string;
  'Total bruto'?: number;
  'Total custos'?: number;
  'Total lucro'?: number;
  'Total desconto'?: number;
};

export type ApiResponse = {
  'Total pages': number;
  Page: number;
  Response: Atendimento[];
};

export type MappedVenda = {
  vendedor_nome: string;
  mes: string;
  data: string;
  detalhes: Record<string, number>;
  valor_total: number;   // líquido = Σ "Valor de venda" dos itens (= ② Tenfront, base de comissão)
  valor_bruto: number;   // faturamento = líquido + juros de parcelamento
  custo: number;         // Σ "Custo" × qtd dos itens de Venda (= custo do Resultado por produto)
  juros: number;
  desconto: number;
};

export type LojaConfig = {
  id: string;
  nome: string;
  bearer: string;
  consumerKey: string;
  consumerSecret: string;
};

export type ItemCategorizado = { valor: number; categoria: string };

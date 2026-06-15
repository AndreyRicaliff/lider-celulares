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
  valor_total: number;
  valor_bruto: number;
};

export type LojaConfig = {
  id: string;
  nome: string;
  bearer: string;
  consumerKey: string;
  consumerSecret: string;
};

export type ItemCategorizado = { valor: number; categoria: string };

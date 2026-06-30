// Formato cru do Tenfront persistido em `atendimentos_audit.detalhes_brutos`.
// Cada atendimento tem 1+ blocos com listas de Venda/Brinde/Troca.

export interface VendaItem {
  Produto?: string;
  Grupo?: string;
  Subtipo?: string;
  Marca?: string;
  Cor?: string;
  Quantidade?: number | string;
  'Valor de venda'?: number | string;
  Valor?: number | string;
  Custo?: number | string;
  Desconto?: number | string;
  'Tipo produto'?: string;
}

export interface ItemSimples {
  Produto?: string;
}

export interface AtendimentoDetalhe {
  Venda?: VendaItem[];
  Brinde?: ItemSimples[];
  Troca?: ItemSimples[];
}

export interface AtendimentoAudit {
  id: string;
  loja_id: string;
  atendimento_id: string;
  vendedor_nome: string;
  data_atendimento: string;
  valor_total: number | null;
  detalhes_brutos: AtendimentoDetalhe[] | null;
  status: string | null;
  mes: string;
  created_at: string;
  alertas_preco: number | null;
  pagamento: unknown;
  total_desconto: number | null;
}

export interface TabelaPreco {
  modelo: string;
  regiao: string;
  memoria: string | null;
  preco_tabela: number | string;
  desconto_livre: number | string | null;
}

export interface ResumoVendedor {
  nome: string;
  atendimentos: number;
  total: number;
  totalReal: number;
  alertas: number;
  qtdCategoria: number;
}

export type CategoriaId =
  | 'geral'
  | 'aparelhos'
  | 'servico'
  | 'bonificado_lc'
  | 'super_bonificado'
  | 'cases'
  | 'peliculas'
  | 'anatel'
  | 'acessorios';

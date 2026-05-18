export type CargoTipo = 'Gerente' | 'Vendedor' | 'VR' | 'Trainee' | 'Supervisor';

export interface Loja {
  id: string;
  nome: string;
  created_at: string;
}

export interface Colaborador {
  id: string;
  nome: string;
  loja_id: string | null;
  cargo: CargoTipo;
  salario: number;
  ajuda_custo: number;
  proporcional_meta: number;
  created_at: string;
  updated_at: string;
}

export interface Divida {
  id: string;
  colaborador_id: string;
  loja_id: string | null;
  descricao: string;
  valor_total: number;
  parcelas_totais: number;
  parcelas_pagas: number;
  mes_inicio: string;
  created_at: string;
}

export interface Venda {
  id: string;
  loja_id: string;
  colaborador_id: string | null;
  vendedor_nome: string;
  mes: string;
  valor_total: number;
  geral?: number;
  detalhes: Record<string, number>;
  created_at: string;
}

export interface VendaDiaria {
  id: string;
  loja_id: string;
  mes: string;
  data: string;
  vendedor_nome: string;
  colaborador_id: string | null;
  valor_total: number;
  smartphones: number;
  acessorios: number;
  servicos: number;
  geral?: number;
  detalhes?: Record<string, number>;
  created_at: string;
}

export interface Comissao {
  id: string;
  loja_id: string;
  colaborador_id: string | null;
  vendedor_nome: string;
  cargo: string;
  mes: string;
  salario: number;
  ajuda_custo: number;
  comissao_base: number;
  comissao_detalhada: Record<string, number>;
  repostagem_venda: number;
  repostagem_comissao: number;
  bonus_automatico: number;
  bonus_manual: number;
  descontos_dividas: number;
  adiantamentos: number;
  descontos: number;
  detalhes: {
    vendedorId?: string;
    dividasInfo?: { id: string; descricao: string; valor: number }[];
    bonusInfo?: string;
    [key: string]: unknown;
  };
  created_at: string;
  updated_at: string;
}

export interface Configuracao {
  id: string;
  loja_id: string;
  mes: string;
  config: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface ColaboradorLoja {
  id: string;
  colaborador_id: string;
  loja_id: string;
  cargo: CargoTipo;
  salario: number;
  ajuda_custo: number;
  proporcional_meta: number;
  created_at: string;
  updated_at: string;
}

export interface ColaboradorComDividas extends Colaborador {
  dividas: Divida[];
  lojas?: ColaboradorLoja[];
}

export const LOJAS = {
  'soledade': 'Soledade',
  'monteiro': 'Monteiro',
  'campina-grande': 'Campina Grande',
  'natal': 'Natal',
  
  'caruaru': 'Caruaru',
} as const;

export const LOJAS_IDS = ['soledade', 'monteiro', 'campina-grande', 'natal', 'caruaru'] as const;
export type LojaId = typeof LOJAS_IDS[number];

export const CARGOS = ['Gerente', 'Vendedor', 'VR', 'Trainee', 'Supervisor'] as const;

export const CATEGORY_COLUMNS = {
  smartphones: ['BONIFICADO LC', 'SUPER BONIFICADO', 'ANATEL'],
  acessorios: ['ACESSÓRIOS'],
  cases: ['CASES'],
  pelicula: ['PELÍCULA'],
  servicos: ['PROTEÇÃO LÍDER', 'GARANTIA ESTENDIDA'],
} as const;

// Colunas informativas que NÃO devem ser somadas no valor_total
// São derivadas/resumos e incluí-las causa duplicação de valores
export const IGNORED_DETAIL_COLUMNS = [
  'VALOR REAL (S/ JUROS)',
  'VALOR SISTEMA (C/ JUROS)',
  'JUROS/TAXAS',
  'TOTAL',
  'VENDA DIÁRIA',
  'VENDA DIARIA',
] as const;

export const isIgnoredColumn = (key: string): boolean =>
  key.startsWith('_') || IGNORED_DETAIL_COLUMNS.some(col => col === key.toUpperCase().trim());

export const DEFAULT_CONFIG_SOLEDADE = {
  geral_comissao: 1.0,
  assistencia_tecnica_comissao: 10.0,
  smartphones_meta: 30000,
  smartphones_comissao_meta_batida: 1.0,
  smartphones_comissao_abaixo_meta: 0.5,
  smartphones_comissao_servico_fase2: 1.5,
  acessorios_meta_estabelecida: 5000,
  acessorios_comissao_estabelecida: 5.0,
  acessorios_comissao_abaixo_meta: 2.5,
  pelicula_meta: 1000,
  pelicula_comissao_meta_batida: 5.0,
  pelicula_comissao_abaixo_meta: 2.5,
  servicos_meta_fase1: 1500,
  servicos_comissao_fase1: 8.0,
  servicos_meta_fase2: 2000,
  servicos_comissao_fase2: 10.0,
  servicos_meta_fase3: 2500,
  servicos_comissao_fase3: 12.0,
  bonus_melhor_servico: 150,
  bonus_melhor_smartphone: 150,
  loja_meta_prata: 50000,
  loja_bonus_meta_prata: 200,
  loja_meta_ouro: 65000,
  loja_bonus_meta_ouro: 300,
};

export const DEFAULT_CONFIG_MONTEIRO = {
  geral_comissao: 1.0,
  assistencia_tecnica_comissao: 10.0,
  smartphones_meta: 30000,
  smartphones_comissao_meta_batida: 1.0,
  smartphones_comissao_abaixo_meta: 0.5,
  smartphones_comissao_servico_fase2: 1.5,
  acessorios_meta_estabelecida: 5000,
  acessorios_comissao_estabelecida: 5.0,
  acessorios_comissao_abaixo_meta: 2.5,
  pelicula_meta: 1000,
  pelicula_comissao_meta_batida: 5.0,
  pelicula_comissao_abaixo_meta: 2.5,
  servicos_meta_fase1: 1500,
  servicos_comissao_fase1: 8.0,
  servicos_meta_fase2: 2000,
  servicos_comissao_fase2: 10.0,
  servicos_meta_fase3: 2500,
  servicos_comissao_fase3: 12.0,
  bonus_melhor_servico: 150,
  bonus_melhor_smartphone: 150,
  loja_meta_prata: 50000,
  loja_bonus_meta_prata: 200,
  loja_meta_ouro: 65000,
  loja_bonus_meta_ouro: 300,
};

export const DEFAULT_CONFIG_CAMPINA_NATAL = {
  geral_comissao: 1.0,
  cases_comissao: 6.0,
  assistencia_tecnica_comissao: 10.0,
  smartphones_meta: 30000,
  smartphones_comissao_blc_meta_batida: 1.0,
  smartphones_comissao_sb_meta_batida: 1.7,
  smartphones_comissao_blc_abaixo_meta: 0.7,
  smartphones_comissao_sb_abaixo_meta: 0.7,
  smartphones_comissao_blc_servico: 2.0,
  smartphones_comissao_sb_servico: 3.0,
  acessorios_meta: 3000,
  natal_acessorios_comissao_meta_batida: 4.0,
  natal_acessorios_comissao_abaixo_meta: 1.5,
  cg_acessorios_comissao_meta_batida: 8.0,
  cg_acessorios_comissao_abaixo_meta: 3.0,
  pelicula_meta: 1000,
  natal_pelicula_meta_minima: 500,
  natal_pelicula_comissao_meta_batida: 10.0,
  natal_pelicula_comissao_meta_minima: 2.0,
  cg_pelicula_meta_minima: 500,
  cg_pelicula_comissao_meta_batida: 5.0,
  cg_pelicula_comissao_abaixo_meta: 2.0,
  servicos_meta_fase1: 1500,
  servicos_comissao_fase1: 8.0,
  servicos_meta_fase2: 2000,
  servicos_comissao_fase2: 10.0,
  servicos_meta_fase3: 2500,
  servicos_comissao_fase3: 12.0,
  bonus_melhor_servico: 200,
  bonus_melhor_smartphone: 150,
  loja_meta_ouro: 85000,
  loja_bonus_meta_ouro: 200,
  gerente_geral_comissao: 0.3,
  gerente_cases_comissao: 2.0,
  gerente_pelicula_comissao: 2.5,
  gerente_acessorios_meta: 5000,
  gerente_acessorios_comissao_cg: 3.0,
  gerente_acessorios_comissao_natal: 1.5,
  gerente_servicos_destrave1_meta: 1500,
  gerente_servicos_destrave1_comissao: 1.0,
  gerente_servicos_destrave2_meta: 2000,
  gerente_servicos_destrave2_comissao: 2.0,
  gerente_servicos_destrave3_meta: 2500,
  gerente_servicos_destrave3_comissao: 3.5,
  gerente_meta_bronze: 200000,
  gerente_meta_prata: 280000,
  gerente_meta_ouro_acrescimo: 10.0,
  gerente_comissao_prata: 0.8,
  gerente_comissao_ouro: 1.1,
  gerente_bonus_bronze: 600,
  natal_cases_divisor: 45,
  natal_cases_faixa1: 225,
  natal_cases_faixa2: 450,
  natal_cases_faixa3: 900,
  natal_cases_bonus_faixa1: 2,
  natal_cases_bonus_faixa2: 5,
  natal_cases_bonus_faixa3: 10,
};
// Mapeamento temporário de nomes de vendedores (Excel → Sistema)
export const VENDOR_NAME_MAPPING: { lojaId: string; mes: string; nomeExcel: string; nomeSistema: string }[] = [
  { lojaId: 'natal', mes: '2026-02', nomeExcel: 'Luiz', nomeSistema: 'HERBERT' },
  { lojaId: 'natal', mes: '2026-02', nomeExcel: 'LUIZ', nomeSistema: 'HERBERT' },
  { lojaId: 'natal', mes: '2026-02', nomeExcel: 'Igor', nomeSistema: 'KAUAN' },
  { lojaId: 'natal', mes: '2026-02', nomeExcel: 'IGOR', nomeSistema: 'KAUAN' },
];

// Overrides de config por vendedor (metas customizadas temporárias)
export const VENDOR_CONFIG_OVERRIDES: { lojaId: string; mes: string; vendedorNome: string; overrides: Record<string, number> }[] = [
  {
    lojaId: 'natal', mes: '2026-02', vendedorNome: 'HERBERT',
    overrides: {
      smartphones_meta: 47850,
      acessorios_meta: 1500,
      natal_pelicula_meta_minima: 2000,
      pelicula_meta: 2500,
      servicos_meta_fase1: 2000,
      servicos_meta_fase2: 3500,
      servicos_meta_fase3: 7000,
      geral_comissao: 0.7,
    }
  },
  {
    lojaId: 'natal', mes: '2026-02', vendedorNome: 'KAUAN',
    overrides: {
      smartphones_meta: 47850,
      acessorios_meta: 1500,
      natal_pelicula_meta_minima: 2000,
      pelicula_meta: 2500,
      servicos_meta_fase1: 2000,
      servicos_meta_fase2: 3500,
      servicos_meta_fase3: 7000,
      geral_comissao: 0.7,
    }
  },
];

// Folha fixa: colaboradores com valor fixo em determinado mês (sem comissões/bônus, apenas descontos de dívidas)
export const FIXED_PAYROLL_OVERRIDES: { lojaId: string; mes: string; vendedorNome: string; valorFixo: number }[] = [
  { lojaId: 'natal', mes: '2026-02', vendedorNome: 'RANIEL', valorFixo: 5000 },
];

// Função para verificar se um colaborador tem folha fixa
export const getFixedPayrollOverride = (lojaId: string, mes: string, vendedorNome: string): number | null => {
  const override = FIXED_PAYROLL_OVERRIDES.find(
    o => o.lojaId === lojaId && o.mes === mes && o.vendedorNome.toLowerCase() === vendedorNome.toLowerCase()
  );
  return override ? override.valorFixo : null;
};

// Exclusões de serviços do cálculo de comissão do supervisor
export const SUPERVISOR_SERVICE_EXCLUSIONS: { lojaId: string; mes: string; vendedorNome: string }[] = [
  { lojaId: 'natal', mes: '2026-02', vendedorNome: 'HERBERT' }, // Vendas de Luiz/Herbert não geram comissão supervisor
];

// Função para obter mapeamento de nome do vendedor
export const getVendorNameMapping = (lojaId: string, mes: string, nomeExcel: string): string => {
  const mapping = VENDOR_NAME_MAPPING.find(
    m => m.lojaId === lojaId && m.mes === mes && m.nomeExcel.toLowerCase() === nomeExcel.toLowerCase()
  );
  return mapping ? mapping.nomeSistema : nomeExcel;
};

// Função para obter config com overrides por vendedor
export const getVendorConfigOverrides = (lojaId: string, mes: string, vendedorNome: string): Record<string, number> | null => {
  const override = VENDOR_CONFIG_OVERRIDES.find(
    o => o.lojaId === lojaId && o.mes === mes && o.vendedorNome.toLowerCase() === vendedorNome.toLowerCase()
  );
  return override ? override.overrides : null;
};

// Verifica se um vendedor deve ser excluído do cálculo de serviços do supervisor
export const isVendedorExcluidoSupervisorServico = (lojaId: string, mes: string, vendedorNome: string): boolean => {
  return SUPERVISOR_SERVICE_EXCLUSIONS.some(
    e => e.lojaId === lojaId && e.mes === mes && e.vendedorNome.toLowerCase() === vendedorNome.toLowerCase()
  );
};

// Exclusões especiais: vendedores a serem ignorados em loja/mês específicos
export const EXCLUSOES_VENDEDORES: { lojaId: string; mes: string; vendedor: string }[] = [
  { lojaId: 'campina-grande', mes: '2025-12', vendedor: 'Matheus' },
];

// Exclusões de vendas específicas que não devem contar para meta/resultados
export const EXCLUSOES_VENDAS: { lojaId: string; mes: string; vendedor: string; valor: number }[] = [
  { lojaId: 'soledade', mes: '2026-04', vendedor: 'LUIZ', valor: 5149.96 },
  { lojaId: 'soledade', mes: '2026-04', vendedor: 'WANESSA', valor: 280.00 },
];

// Lojas excluídas dos botons premiados em meses específicos
export const BOTONS_EXCLUSOES_LOJA: { lojaId: string; mes: string }[] = [
  { lojaId: 'caruaru', mes: '2026-04' },
];

export const isLojaExcluidaBotons = (lojaId: string, mes: string): boolean =>
  BOTONS_EXCLUSOES_LOJA.some(e => e.lojaId === lojaId && e.mes === mes);

// Overrides manuais de botons premiados (correções de lógica ou exceções solicitadas)
export const BOTONS_MANUAL_OVERRIDES: { colaboradorId?: string; vendedorNome?: string; mes: string; tipo: 'triplice_coroa' | 'protecao_lider'; pontos: number }[] = [
  { colaboradorId: '992001b2-2153-4d38-a0b5-3e2113858327', mes: '2026-04', tipo: 'triplice_coroa', pontos: 10 }, // Flávio Abril/2026
  { vendedorNome: 'FLAVIO', mes: '2026-04', tipo: 'triplice_coroa', pontos: 10 }, // Flávio Abril/2026 (backup por nome)
];

export const getBotonOverride = (colaboradorId: string, mes: string, vendedorNome?: string) => {
  return BOTONS_MANUAL_OVERRIDES.find(o => 
    (o.colaboradorId === colaboradorId || (vendedorNome && o.vendedorNome === vendedorNome.toUpperCase().trim())) && 
    o.mes === mes
  );
};

// Ajustes de bônus proporcionais: para colaboradores que entraram no meio do mês
export const AJUSTES_BONUS: { lojaId: string; mes: string; vendedor: string; percentual: number }[] = [
  { lojaId: 'campina-grande', mes: '2025-01', vendedor: 'Celio', percentual: 50 }, // Entrou na metade do mês
];

// Função para obter o percentual de ajuste de bônus
export const getAjusteBonusPercentual = (lojaId: string, mes: string, vendedorNome: string): number => {
  const ajuste = AJUSTES_BONUS.find(
    a => 
      a.lojaId === lojaId && 
      a.mes === mes && 
      a.vendedor.toLowerCase() === vendedorNome.toLowerCase()
  );
  return ajuste ? ajuste.percentual : 100; // 100% = sem ajuste
};

export const getDefaultConfig = (lojaId: string) => {
  if (lojaId === 'soledade') {
    return DEFAULT_CONFIG_SOLEDADE;
  }
  if (lojaId === 'monteiro') {
    return DEFAULT_CONFIG_MONTEIRO;
  }
  // Campina Grande, Natal e Caruaru usam a mesma estrutura
  return DEFAULT_CONFIG_CAMPINA_NATAL;
};

// Verifica se um vendedor deve ser excluído dos cálculos
export const isVendedorExcluido = (lojaId: string, mes: string, vendedorNome: string): boolean => {
  return EXCLUSOES_VENDEDORES.some(
    exclusao => 
      exclusao.lojaId === lojaId && 
      exclusao.mes === mes && 
      exclusao.vendedor.toLowerCase() === vendedorNome.toLowerCase()
  );
};

// Verifica se uma venda específica deve ser excluída
export const isVendaExcluida = (lojaId: string, mes: string, vendedorNome: string, valor: number): boolean => {
  return EXCLUSOES_VENDAS.some(
    exclusao => 
      exclusao.lojaId === lojaId && 
      exclusao.mes === mes && 
      exclusao.vendedor.toLowerCase() === vendedorNome.toLowerCase() &&
      Math.abs(exclusao.valor - valor) < 0.01
  );
};

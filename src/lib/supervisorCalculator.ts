import { Venda, Divida } from '@/types/database';
import { isVendedorExcluidoSupervisorServico } from './constants';

// Lojas que participam do cálculo de supervisão (exclui caruaru e natal-tenfront que é mergeado com natal)
const LOJAS_SUPERVISAO = ['soledade', 'monteiro', 'campina-grande', 'natal', 'caruaru'] as const;

// Regras de cálculo para os supervisores
export interface SupervisorConfig {
  nome: string;
  salarioBase: number;
  lojasDivisorSalario: number; // Número de lojas para dividir salário
  ajudaCusto: number;
  lojasAjudaCusto: string[]; // Lojas que recebem ajuda de custo
  comissaoServicoLoja: number; // % de comissão por serviço de cada loja
  comissaoServicoVendaPropria: number; // % de comissão em vendas próprias de serviço
  bonusMetaBatida: number; // Bônus por meta batida
  bonusSuperMeta: number; // Bônus por super meta (substitui bonusMetaBatida)
  taxaAdministrativa: number; // Valor fixo de taxa administrativa
  lojaTaxaAdministrativa: string | null; // Loja específica para taxa administrativa (null = dividir por todas)
  salarioMinimo: number; // Salário mínimo garantido
}

// Overrides pontuais de bônus por supervisor + loja + mês (YYYY-MM)
// Útil quando o bônus de meta batida/super meta precisa ser diferente do padrão
// em uma loja específica em um mês específico.
export const SUPERVISOR_BONUS_OVERRIDES: Record<
  string,
  Record<string, Record<string, { bonusMetaBatida?: number; bonusSuperMeta?: number }>>
> = {
  Luiz: {
    caruaru: {
      '2026-04': { bonusMetaBatida: 400, bonusSuperMeta: 400 },
    },
  },
};

export const SUPERVISORES_CONFIG: Record<string, SupervisorConfig> = {
  'Luiz': {
    nome: 'Luiz',
    salarioBase: 3625, // 725 * 5 lojas
    lojasDivisorSalario: 5, // 5 lojas (soledade, monteiro, campina, natal, caruaru)
    ajudaCusto: 200,
    lojasAjudaCusto: ['monteiro', 'soledade', 'campina-grande', 'caruaru'], // 4 lojas
    comissaoServicoLoja: 2,
    comissaoServicoVendaPropria: 12,
    bonusMetaBatida: 600,
    bonusSuperMeta: 700,
    taxaAdministrativa: 300,
    lojaTaxaAdministrativa: 'natal',
    salarioMinimo: 4000,
  },
  'Cid': {
    nome: 'Cid',
    salarioBase: 1750,
    lojasDivisorSalario: 5, // 5 lojas
    ajudaCusto: 0,
    lojasAjudaCusto: [],
    comissaoServicoLoja: 2,
    comissaoServicoVendaPropria: 0,
    bonusMetaBatida: 0,
    bonusSuperMeta: 0,
    taxaAdministrativa: 0,
    lojaTaxaAdministrativa: null,
    salarioMinimo: 0,
  },
};

export interface SupervisorLojaResult {
  lojaId: string;
  lojaNome: string;
  salario: number;
  ajudaCusto: number;
  comissaoServicoLoja: number;
  comissaoServicoVendaPropria: number;
  bonusMeta: number;
  taxaAdministrativa: number;
  complemento: number;
  descontoDividas: number;
  dividasInfo: { id: string; descricao: string; valor: number; parcelaAtual: number }[];
  total: number;
}

export interface SupervisorResult {
  nome: string;
  resultadosPorLoja: SupervisorLojaResult[];
  totalGeral: number;
  todasDividasInfo: { id: string; parcelaAtual: number }[];
}

// Calcula total de serviços por loja (com exclusão de vendedores específicos)
const calcularTotalServicosLoja = (vendasLoja: Venda[], lojaId?: string, mes?: string): number => {
  return vendasLoja.reduce((total, venda) => {
    // Excluir serviços de vendedores específicos (ex: Luiz/Herbert em Natal fev)
    if (lojaId && mes && isVendedorExcluidoSupervisorServico(lojaId, mes, venda.vendedor_nome)) {
      return total;
    }
    const protecao = (venda.detalhes['PROTEÇÃO LÍDER'] || 0);
    const garantia = (venda.detalhes['GARANTIA ESTENDIDA'] || 0);
    return total + protecao + garantia;
  }, 0);
};

// Calcula serviços vendidos pelo supervisor específico
const calcularServicosProprios = (vendasLoja: Venda[], supervisorNome: string): number => {
  return vendasLoja
    .filter(v => v.vendedor_nome.toLowerCase() === supervisorNome.toLowerCase())
    .reduce((total, venda) => {
      const protecao = (venda.detalhes['PROTEÇÃO LÍDER'] || 0);
      const garantia = (venda.detalhes['GARANTIA ESTENDIDA'] || 0);
      return total + protecao + garantia;
    }, 0);
};

// Verifica se loja bateu meta (prata)
const verificarMetaBatida = (
  vendasLoja: Venda[],
  lojaId: string,
  config: Record<string, number>
): boolean => {
  const valorSmartphones = vendasLoja.reduce((total, venda) => {
    const blc = (venda.detalhes['BONIFICADO LC'] || 0);
    const sb = (venda.detalhes['SUPER BONIFICADO'] || 0);
    const anatel = (venda.detalhes['ANATEL'] || 0);
    return total + blc + sb + anatel;
  }, 0);
  
  const valorServicos = calcularTotalServicosLoja(vendasLoja);
  
  if (lojaId === 'soledade' || lojaId === 'monteiro') {
    // Soledade/Monteiro: usar loja_meta_prata (todas categorias exceto GERAL)
    const metaPrata = config.loja_meta_prata || 50000;
    const totalSemGeral = valorSmartphones + valorServicos + 
      vendasLoja.reduce((t, v) => t + (v.detalhes['ACESSÓRIOS'] || 0) + (v.detalhes['CASES'] || 0) + 
                                      (v.detalhes['PELÍCULA'] || 0) + (v.detalhes['ASSISTÊNCIA TÉCNICA'] || 0), 0);
    return totalSemGeral >= metaPrata;
  } else {
    // Campina/Natal: usar gerente_meta_prata (smartphones + serviços)
    const metaPrata = config.gerente_meta_prata || 50000;
    const totalParaMeta = valorSmartphones + valorServicos;
    return totalParaMeta >= metaPrata;
  }
};

// Verifica se loja bateu super meta (ouro)
const verificarSuperMetaBatida = (
  vendasLoja: Venda[],
  lojaId: string,
  config: Record<string, number>
): boolean => {
  const valorSmartphones = vendasLoja.reduce((total, venda) => {
    const blc = (venda.detalhes['BONIFICADO LC'] || 0);
    const sb = (venda.detalhes['SUPER BONIFICADO'] || 0);
    const anatel = (venda.detalhes['ANATEL'] || 0);
    return total + blc + sb + anatel;
  }, 0);
  
  if (lojaId === 'soledade' || lojaId === 'monteiro') {
    // Meta Ouro: exclui serviços e GERAL
    const metaOuro = config.loja_meta_ouro || 65000;
    const totalSemGeralSemServicos = valorSmartphones + 
      vendasLoja.reduce((t, v) => t + (v.detalhes['ACESSÓRIOS'] || 0) + (v.detalhes['CASES'] || 0) + 
                                      (v.detalhes['PELÍCULA'] || 0) + (v.detalhes['ASSISTÊNCIA TÉCNICA'] || 0), 0);
    return totalSemGeralSemServicos >= metaOuro;
  } else {
    // Campina/Natal: meta ouro = meta prata + acréscimo (APENAS smartphones)
    const metaPrata = config.gerente_meta_prata || 50000;
    const acrescimo = config.gerente_meta_ouro_acrescimo || 10;
    const metaOuro = metaPrata * (1 + acrescimo / 100);
    return valorSmartphones >= metaOuro;
  }
};

export function calcularFolhaSupervisor(
  supervisorNome: string,
  vendasPorLoja: Record<string, Venda[]>,
  configsPorLoja: Record<string, Record<string, number>>,
  dividas: Divida[] = [],
  mes: string = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  _lojasDividasAplicadas: string[] = [] // Mantido para compatibilidade, mas não usado - usamos loja_id da dívida
): SupervisorResult | null {
  const supervisorConfig = SUPERVISORES_CONFIG[supervisorNome];
  if (!supervisorConfig) return null;
  
  const LOJAS_NOMES: Record<string, string> = {
    'soledade': 'Soledade',
    'monteiro': 'Monteiro',
    'campina-grande': 'Campina Grande',
    'natal': 'Natal',
    'caruaru': 'Caruaru',
  };
  
  const numLojas = LOJAS_SUPERVISAO.length;
  
  // Calcular dívidas por loja usando loja_id da própria dívida
  const dividasPorLoja: Record<string, { total: number; dividasInfo: { id: string; descricao: string; valor: number; parcelaAtual: number }[] }> = {};
  
  dividas.forEach(divida => {
    const mesInicio = new Date(divida.mes_inicio + '-02');
    const mesAtual = new Date(mes + '-02');
    
    // Só aplicar se o mês atual for >= mês de início
    if (mesAtual < mesInicio) return;
    
    // Calcular quantos meses se passaram desde o início (0 = primeiro mês)
    const mesesDesdeInicio = (mesAtual.getFullYear() - mesInicio.getFullYear()) * 12 + 
                             (mesAtual.getMonth() - mesInicio.getMonth());
    
    // O número da parcela que deveria ser descontada neste mês (1-indexed)
    const parcelaDoMes = mesesDesdeInicio + 1;
    
    // Próxima parcela a ser paga (1-indexed)
    const proximaParcela = divida.parcelas_pagas + 1;
    
    // Só descontar se:
    // 1. A parcela do mês está dentro do total de parcelas
    // 2. A parcela do mês é >= próxima parcela (parcelas pendentes)
    if (parcelaDoMes <= divida.parcelas_totais) {
      const valorParcela = divida.valor_total / divida.parcelas_totais;
      const lojaId = divida.loja_id || 'soledade'; // Fallback para primeira loja se não tiver loja_id
      
      if (!dividasPorLoja[lojaId]) {
        dividasPorLoja[lojaId] = { total: 0, dividasInfo: [] };
      }
      dividasPorLoja[lojaId].total += valorParcela;
      dividasPorLoja[lojaId].dividasInfo.push({ 
        id: divida.id, 
        descricao: divida.descricao, 
        valor: valorParcela,
        parcelaAtual: parcelaDoMes
      });
    }
  });
  
  const resultadosPorLoja: SupervisorLojaResult[] = [];
  let totalGeralParcial = 0;
  
  // Para cada loja
  for (const lojaId of LOJAS_SUPERVISAO) {
    const vendasLoja = vendasPorLoja[lojaId] || [];
    const config = configsPorLoja[lojaId] || {};
    
    // Salário dividido pelas lojas (usando config do supervisor)
    const salario = supervisorConfig.salarioBase / supervisorConfig.lojasDivisorSalario;
    
    // Ajuda de custo (somente para lojas específicas)
    const ajudaCusto = supervisorConfig.lojasAjudaCusto.includes(lojaId)
      ? supervisorConfig.ajudaCusto / supervisorConfig.lojasAjudaCusto.length
      : 0;
    
    // Comissão de 2% sobre serviços da loja (excluindo vendedores específicos)
    const totalServicosLoja = calcularTotalServicosLoja(vendasLoja, lojaId, mes);
    const comissaoServicoLoja = totalServicosLoja * (supervisorConfig.comissaoServicoLoja / 100);
    
    // Comissão de vendas próprias (12% para Luiz)
    const servicosProprios = calcularServicosProprios(vendasLoja, supervisorNome);
    const comissaoServicoVendaPropria = servicosProprios * (supervisorConfig.comissaoServicoVendaPropria / 100);
    
    // Bônus de meta (600 meta normal, 700 super meta - não soma)
    // Aplica overrides pontuais por loja+mês quando configurados
    const override = SUPERVISOR_BONUS_OVERRIDES[supervisorNome]?.[lojaId]?.[mes];
    const bonusMetaBatidaEfetivo = override?.bonusMetaBatida ?? supervisorConfig.bonusMetaBatida;
    const bonusSuperMetaEfetivo = override?.bonusSuperMeta ?? supervisorConfig.bonusSuperMeta;

    let bonusMeta = 0;
    if (bonusSuperMetaEfetivo > 0 || bonusMetaBatidaEfetivo > 0) {
      const bateuMeta = verificarMetaBatida(vendasLoja, lojaId, config);
      
      // Meta ouro só pode ser atingida se meta prata também foi atingida
      if (bateuMeta) {
        const bateuSuperMeta = verificarSuperMetaBatida(vendasLoja, lojaId, config);
        if (bateuSuperMeta) {
          bonusMeta = bonusSuperMetaEfetivo;
        } else {
          bonusMeta = bonusMetaBatidaEfetivo;
        }
      }
    }
    
    // Taxa administrativa (só na loja específica ou dividida por 4)
    let taxaAdministrativa = 0;
    if (supervisorConfig.taxaAdministrativa > 0) {
      if (supervisorConfig.lojaTaxaAdministrativa) {
        // Taxa só para loja específica
        taxaAdministrativa = lojaId === supervisorConfig.lojaTaxaAdministrativa 
          ? supervisorConfig.taxaAdministrativa 
          : 0;
      } else {
        // Taxa dividida por todas as lojas
        taxaAdministrativa = supervisorConfig.taxaAdministrativa / numLojas;
      }
    }
    
    // Desconto de dívidas - aplicar na loja onde a dívida foi cadastrada
    const descontoDividas = dividasPorLoja[lojaId]?.total || 0;
    const dividasInfoLoja = dividasPorLoja[lojaId]?.dividasInfo || [];
    
    const totalLoja = salario + ajudaCusto + comissaoServicoLoja + comissaoServicoVendaPropria + bonusMeta + taxaAdministrativa - descontoDividas;
    
    resultadosPorLoja.push({
      lojaId,
      lojaNome: LOJAS_NOMES[lojaId],
      salario,
      ajudaCusto,
      comissaoServicoLoja,
      comissaoServicoVendaPropria,
      bonusMeta,
      taxaAdministrativa,
      descontoDividas,
      dividasInfo: dividasInfoLoja,
      complemento: 0,
      total: totalLoja,
    });
    
    totalGeralParcial += totalLoja;
  }
  
  // Verificar salário mínimo e distribuir complemento
  if (supervisorConfig.salarioMinimo > 0 && totalGeralParcial < supervisorConfig.salarioMinimo) {
    const complementoTotal = supervisorConfig.salarioMinimo - totalGeralParcial;
    const complementoPorLoja = complementoTotal / numLojas;
    
    resultadosPorLoja.forEach(r => {
      r.complemento = complementoPorLoja;
      r.total += complementoPorLoja;
    });
    
    totalGeralParcial = supervisorConfig.salarioMinimo;
  }
  
  // Coletar todas as dívidas de todas as lojas
  const todasDividasInfo: { id: string; parcelaAtual: number }[] = [];
  resultadosPorLoja.forEach(loja => {
    loja.dividasInfo.forEach(d => {
      todasDividasInfo.push({ id: d.id, parcelaAtual: d.parcelaAtual });
    });
  });
  
  return {
    nome: supervisorNome,
    resultadosPorLoja,
    totalGeral: totalGeralParcial,
    todasDividasInfo,
  };
}

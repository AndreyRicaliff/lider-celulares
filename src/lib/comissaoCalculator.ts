import { Colaborador, Divida } from '@/types/database';
import { getDefaultConfig } from './constants';
import { calcularDescontosDividasNoMes, type DividaAplicadaNoMes } from './dividasCalculator';
import { isLojaCampinaNatal, isLojaNatalLike } from './lojaRules';

export interface CalculoResult {
  comissao: number;
  info: {
    atingiuFase3Servico: boolean;
    penalidadePelicula?: boolean;
    penalidadeAcessorios?: boolean;
  };
  comissaoDetalhada: Record<string, number>;
}

const safeGet = (totais: Record<string, number>, col: string): number => {
  return totais[col.toUpperCase()] || 0;
};

export function calcularComissaoSoledadeMonteiro(
  colaborador: Colaborador,
  totais: Record<string, number>,
  config: Record<string, number>
): CalculoResult {
  const comissoes: Record<string, number> = {};
  const info = { atingiuFase3Servico: false };
  const proporcional = (colaborador.proporcional_meta || 100) / 100;
  const isTrainee = colaborador.cargo === 'Trainee';
  const isMonteiro = colaborador.loja_id === 'monteiro';

  // Geral
  comissoes.GERAL = safeGet(totais, 'GERAL') * (config.geral_comissao / 100);

  // Cases: sistema de divisor/faixas (se configurado)
  const casesDivisor = config.cases_divisor || 0;
  if (casesDivisor > 0) {
    const valorCases = safeGet(totais, 'CASES');
    const faixa1 = config.cases_faixa1 || 0;
    const faixa2 = config.cases_faixa2 || 0;
    const faixa3 = config.cases_faixa3 || 0;
    const bonus1 = config.cases_bonus_faixa1 || 0;
    const bonus2 = config.cases_bonus_faixa2 || 0;
    const bonus3 = config.cases_bonus_faixa3 || 0;

    if (valorCases >= faixa1 && faixa1 > 0) {
      const kits = Math.ceil(valorCases / casesDivisor);
      let multiplicador = 0;
      if (valorCases >= faixa3 && faixa3 > 0) {
        multiplicador = bonus3;
      } else if (valorCases >= faixa2 && faixa2 > 0) {
        multiplicador = bonus2;
      } else {
        multiplicador = bonus1;
      }
      comissoes.CASES = kits * multiplicador;
    } else {
      comissoes.CASES = 0;
    }
  }

  // Assistência Técnica (apenas Soledade)
  if (!isMonteiro) {
    comissoes['ASSIST. TÉCNICA'] = safeGet(totais, 'ASSISTÊNCIA TÉCNICA') * (config.assistencia_tecnica_comissao / 100);
  }

  // Acessórios: meta única com above/below (sem penalidade)
  const valorAcessorios = safeGet(totais, 'ACESSÓRIOS');
  const taxaAcessorios = (isTrainee || valorAcessorios >= (config.acessorios_meta_estabelecida * proporcional))
    ? config.acessorios_comissao_estabelecida
    : (config.acessorios_comissao_abaixo_meta || 2.5);
  comissoes.ACESSÓRIOS = valorAcessorios * (taxaAcessorios / 100);

  // Película
  const valorPelicula = safeGet(totais, 'PELÍCULA');
  comissoes.PELÍCULA = valorPelicula * (isTrainee || valorPelicula >= (config.pelicula_meta * proporcional)
    ? config.pelicula_comissao_meta_batida
    : config.pelicula_comissao_abaixo_meta) / 100;

  // Serviços (calcular antes dos smartphones para usar tier de serviço)
  const valorPL = safeGet(totais, 'PROTEÇÃO LÍDER');
  const valorGE = safeGet(totais, 'GARANTIA ESTENDIDA');
  const valorServicos = valorPL + valorGE;
  let taxaServicos = 0;
  let servicoFase2Atingida = false;
  if (isTrainee || valorServicos >= (config.servicos_meta_fase3 * proporcional)) {
    taxaServicos = config.servicos_comissao_fase3;
    info.atingiuFase3Servico = true;
    servicoFase2Atingida = true;
  } else if (valorServicos >= (config.servicos_meta_fase2 * proporcional)) {
    taxaServicos = config.servicos_comissao_fase2;
    servicoFase2Atingida = true;
  } else if (valorServicos >= (config.servicos_meta_fase1 * proporcional)) {
    taxaServicos = config.servicos_comissao_fase1;
  }
  comissoes['PROTEÇÃO LÍDER'] = valorPL * (taxaServicos / 100);
  comissoes['GARANTIA ESTENDIDA'] = valorGE * (taxaServicos / 100);

  // Smartphones: 0.5% abaixo meta, 1% meta batida, 1.5% quando atinge fase2 de serviço
  const valorBLC = safeGet(totais, 'BONIFICADO LC');
  const valorSB = safeGet(totais, 'SUPER BONIFICADO');
  const valorAnatel = safeGet(totais, 'ANATEL');
  const valorSmartphones = valorBLC + valorSB + valorAnatel;
  const metaSmartphonesAtingida = isTrainee ||
    (valorSmartphones >= (config.smartphones_meta * proporcional)) ||
    ((valorSmartphones + valorServicos) >= (config.smartphones_meta * proporcional));

  let taxaSmartphones: number;
  if (servicoFase2Atingida) {
    taxaSmartphones = config.smartphones_comissao_servico_fase2;
  } else if (metaSmartphonesAtingida) {
    taxaSmartphones = config.smartphones_comissao_meta_batida;
  } else {
    taxaSmartphones = config.smartphones_comissao_abaixo_meta;
  }
  comissoes['BONIFICADO LC'] = valorBLC * (taxaSmartphones / 100);
  comissoes['SUPER BONIFICADO'] = valorSB * (taxaSmartphones / 100);
  comissoes['ANATEL'] = valorAnatel * (taxaSmartphones / 100);

  return {
    comissao: Object.values(comissoes).reduce((t, v) => t + v, 0),
    info,
    comissaoDetalhada: comissoes
  };
}

export function calcularBonusMetaLojaSoledadeMonteiro(
  totaisLoja: Record<string, number>,
  config: Record<string, number>,
  lojaId: string
): number {
  // Soledade/Monteiro:
  // Meta Prata: TODAS categorias EXCETO GERAL
  // Meta Ouro: TODAS categorias EXCETO Serviços e GERAL
  // Regra de negócio: Monteiro NÃO tem bônus de Meta Prata.
  const valorSmartphones = safeGet(totaisLoja, 'BONIFICADO LC') + safeGet(totaisLoja, 'SUPER BONIFICADO') + safeGet(totaisLoja, 'ANATEL');
  const valorServicos = safeGet(totaisLoja, 'PROTEÇÃO LÍDER') + safeGet(totaisLoja, 'GARANTIA ESTENDIDA');
  const valorAcessorios = safeGet(totaisLoja, 'ACESSÓRIOS');
  const valorCases = safeGet(totaisLoja, 'CASES');
  const valorPelicula = safeGet(totaisLoja, 'PELÍCULA');
  const valorAssistencia = safeGet(totaisLoja, 'ASSISTÊNCIA TÉCNICA');
  
  const totalSemGeralSemServicos = valorSmartphones + valorAcessorios + valorCases + valorPelicula + valorAssistencia;
  const totalSemGeral = totalSemGeralSemServicos + valorServicos;

  // Bônus não são acumulativos: se bater ouro, ganha só ouro; se bater prata, ganha só prata
  if (totalSemGeralSemServicos >= config.loja_meta_ouro) {
    return config.loja_bonus_meta_ouro || 300;
  } else if (totalSemGeral >= config.loja_meta_prata) {
    if (lojaId === 'monteiro') return 0;
    return config.loja_bonus_meta_prata || 200;
  }
  return 0;
}

export function calcularComissaoCampinaNatal(
  colaborador: Colaborador,
  totais: Record<string, number>,
  config: Record<string, number>,
  loja: string,
  mes?: string
): CalculoResult {
  const comissoes: Record<string, number> = {};
  const info = { atingiuFase3Servico: false, penalidadePelicula: false };
  const proporcional = (colaborador.proporcional_meta || 100) / 100;
  const isTrainee = colaborador.cargo === 'Trainee';
  const isCampinaGrande = loja === 'campina-grande';
  const isNatalLike = isLojaNatalLike(loja);

  comissoes.GERAL = safeGet(totais, 'GERAL') * (config.geral_comissao / 100);

  // Cases: Natal/CG/Caruaru usam sistema de divisor/faixas
  if (isLojaCampinaNatal(loja) || loja === 'caruaru') {
    const valorCases = safeGet(totais, 'CASES');
    const prefix = isCampinaGrande ? 'cg' : 'natal';
    const divisor = config[`${prefix}_cases_divisor`] || config.natal_cases_divisor || 45;
    const faixa1 = config[`${prefix}_cases_faixa1`] || config.natal_cases_faixa1 || 225;
    const faixa2 = config[`${prefix}_cases_faixa2`] || config.natal_cases_faixa2 || 450;
    const faixa3 = config[`${prefix}_cases_faixa3`] || config.natal_cases_faixa3 || 900;
    const bonus1 = config[`${prefix}_cases_bonus_faixa1`] || config.natal_cases_bonus_faixa1 || 2;
    const bonus2 = config[`${prefix}_cases_bonus_faixa2`] || config.natal_cases_bonus_faixa2 || 5;
    const bonus3 = config[`${prefix}_cases_bonus_faixa3`] || config.natal_cases_bonus_faixa3 || 10;

    if (valorCases >= faixa1 && divisor > 0) {
      const kits = Math.ceil(valorCases / divisor);
      let multiplicador = 0;
      if (valorCases >= faixa3) {
        multiplicador = bonus3;
      } else if (valorCases >= faixa2) {
        multiplicador = bonus2;
      } else {
        multiplicador = bonus1;
      }
      comissoes.CASES = kits * multiplicador;
    } else {
      comissoes.CASES = 0;
    }
  }

  comissoes['ASSIST. TÉCNICA'] = safeGet(totais, 'ASSISTÊNCIA TÉCNICA') * (config.assistencia_tecnica_comissao / 100);

  // Pré-calcular serviços para usar no bônus de smartphones (CG)
  const valorPL = safeGet(totais, 'PROTEÇÃO LÍDER');
  const valorGE = safeGet(totais, 'GARANTIA ESTENDIDA');
  const valorServicos = valorPL + valorGE;
  const servicoFase1Atingida = isTrainee || valorServicos >= (config.servicos_meta_fase1 * proporcional);

  const valorBonificadoLC = safeGet(totais, 'BONIFICADO LC');
  const valorSuperBonificado = safeGet(totais, 'SUPER BONIFICADO');
  // Removido categorias intermediárias "SMARTPHONES E FILMES" para evitar confusão no relatório
  const valorSmartphones = valorBonificadoLC + valorSuperBonificado;
  const valorAuxiliarServicos = valorServicos;
  const metaSmartphonesAtingida = isTrainee ||
    (valorSmartphones >= (config.smartphones_meta * proporcional)) ||
    ((valorSmartphones + valorAuxiliarServicos) >= (config.smartphones_meta * proporcional));

  let taxaBLC = 0;
  let taxaSB = 0;
  if (isCampinaGrande) {
    // CG: service tier affects smartphone rates
    if (servicoFase1Atingida) {
      taxaBLC = config.smartphones_comissao_blc_servico;
      taxaSB = config.smartphones_comissao_sb_servico;
    } else if (metaSmartphonesAtingida) {
      taxaBLC = config.smartphones_comissao_blc_meta_batida;
      taxaSB = config.smartphones_comissao_sb_meta_batida;
    } else {
      taxaBLC = config.smartphones_comissao_blc_abaixo_meta;
      taxaSB = config.smartphones_comissao_sb_abaixo_meta;
    }
  } else {
    // Natal/Caruaru: mantém lógica original
    if (metaSmartphonesAtingida) {
      taxaBLC = config.smartphones_comissao_blc_meta_batida;
      taxaSB = config.smartphones_comissao_sb_meta_batida;
    } else {
      taxaBLC = config.smartphones_comissao_blc_abaixo_meta;
      taxaSB = config.smartphones_comissao_sb_abaixo_meta;
    }
  }
  comissoes['BONIFICADO LC'] = valorBonificadoLC * (taxaBLC / 100);
  comissoes['SUPER BONIFICADO'] = valorSuperBonificado * (taxaSB / 100);

  const valorAcessorios = safeGet(totais, 'ACESSÓRIOS');
  let taxaAcessorios = 0;
  if (isNatalLike) {
    taxaAcessorios = isTrainee || valorAcessorios >= (config.acessorios_meta * proporcional)
      ? config.natal_acessorios_comissao_meta_batida
      : config.natal_acessorios_comissao_abaixo_meta;
  } else {
    taxaAcessorios = isTrainee || valorAcessorios >= (config.acessorios_meta * proporcional)
      ? config.cg_acessorios_comissao_meta_batida
      : config.cg_acessorios_comissao_abaixo_meta;
  }
  comissoes.ACESSÓRIOS = valorAcessorios * (taxaAcessorios / 100);

  // Película: count standard película + smartphones e filmes bundle (que inclui película no kit)
  const valorPelicula = safeGet(totais, 'PELÍCULA');
  let taxaPelicula = 0;
  if (isNatalLike) {
    if (isTrainee || valorPelicula >= (config.pelicula_meta * proporcional)) {
      taxaPelicula = config.natal_pelicula_comissao_meta_batida;
    } else if (valorPelicula >= (config.natal_pelicula_meta_minima * proporcional)) {
      taxaPelicula = config.natal_pelicula_comissao_meta_minima;
    } else {
      info.penalidadePelicula = true;
      taxaPelicula = 0;
    }
  } else {
  // CG: penalidade de película - se não bater meta mínima, perde smartphones e película
    if (isTrainee || valorPelicula >= (config.pelicula_meta * proporcional)) {
      taxaPelicula = config.cg_pelicula_comissao_meta_batida;
    } else if (valorPelicula >= (config.cg_pelicula_meta_minima * proporcional)) {
      taxaPelicula = config.cg_pelicula_comissao_abaixo_meta;
    } else {
      info.penalidadePelicula = true;
      taxaPelicula = 0;
    }
  }
  comissoes.PELÍCULA = valorPelicula * (taxaPelicula / 100);

  let taxaServicos = 0;
  if (isTrainee || valorServicos >= (config.servicos_meta_fase3 * proporcional)) {
    taxaServicos = config.servicos_comissao_fase3;
    info.atingiuFase3Servico = true;
  } else if (valorServicos >= (config.servicos_meta_fase2 * proporcional)) {
    taxaServicos = config.servicos_comissao_fase2;
  } else if (valorServicos >= (config.servicos_meta_fase1 * proporcional)) {
    taxaServicos = config.servicos_comissao_fase1;
  }
  comissoes['PROTEÇÃO LÍDER'] = valorPL * (taxaServicos / 100);
  comissoes['GARANTIA ESTENDIDA'] = valorGE * (taxaServicos / 100);

  if (info.penalidadePelicula && !isTrainee) {
    comissoes['BONIFICADO LC'] = 0;
    comissoes['SUPER BONIFICADO'] = 0;
    comissoes['SMARTPHONES E FILMES'] = 0;
    comissoes.PELÍCULA = 0;
  }

  return {
    comissao: Object.values(comissoes).reduce((t, v) => t + v, 0),
    info,
    comissaoDetalhada: comissoes
  };
}

export function calcularComissaoGerente(
  totaisLoja: Record<string, number>,
  config: Record<string, number>,
  loja: string
): CalculoResult & { bonus: number } {
  const comissoes: Record<string, number> = {};
  let bonus = 0;

  comissoes.GERAL = safeGet(totaisLoja, 'GERAL') * (config.gerente_geral_comissao / 100);
  comissoes.CASES = safeGet(totaisLoja, 'CASES') * (config.gerente_cases_comissao / 100);
  comissoes.PELÍCULA = safeGet(totaisLoja, 'PELÍCULA') * (config.gerente_pelicula_comissao / 100);

  const valorAcessorios = safeGet(totaisLoja, 'ACESSÓRIOS');
  if (valorAcessorios >= config.gerente_acessorios_meta) {
    const taxa = loja === 'campina-grande' ? config.gerente_acessorios_comissao_cg : config.gerente_acessorios_comissao_natal;
    comissoes.ACESSÓRIOS = valorAcessorios * (taxa / 100);
  }

  const valorServicos = safeGet(totaisLoja, 'PROTEÇÃO LÍDER') + safeGet(totaisLoja, 'GARANTIA ESTENDIDA');
  let taxaServicos = 0;
  if (valorServicos >= config.gerente_servicos_destrave3_meta) {
    taxaServicos = config.gerente_servicos_destrave3_comissao;
  } else if (valorServicos >= config.gerente_servicos_destrave2_meta) {
    taxaServicos = config.gerente_servicos_destrave2_comissao;
  } else if (valorServicos >= config.gerente_servicos_destrave1_meta) {
    taxaServicos = config.gerente_servicos_destrave1_comissao;
  }
  comissoes.SERVIÇOS = valorServicos * (taxaServicos / 100);

  const valorSmartphones = safeGet(totaisLoja, 'BONIFICADO LC') + safeGet(totaisLoja, 'SUPER BONIFICADO');
  const valorAuxiliarServicos = safeGet(totaisLoja, 'PROTEÇÃO LÍDER') + safeGet(totaisLoja, 'GARANTIA ESTENDIDA');
  const metaBronze = config.gerente_meta_bronze;
  const metaPrata = config.gerente_meta_prata;
  const metaOuro = metaPrata * (1 + (config.gerente_meta_ouro_acrescimo / 100));
  const totalParaMetaPrata = valorSmartphones + valorAuxiliarServicos; // Para meta prata/bronze

  // Sistema escalonado e excludente:
  // - Meta Ouro: APENAS smartphones deve atingir a meta (valorSmartphones >= metaOuro)
  // - Meta Prata: smartphones + serviços deve atingir a meta (totalParaMetaPrata >= metaPrata)
  // - Meta Bronze: bônus fixo de R$600 (só se não atingiu prata/ouro)
  if (valorSmartphones >= metaOuro) {
    comissoes['META OURO (Smartphones)'] = valorSmartphones * (config.gerente_comissao_ouro / 100);
  } else if (totalParaMetaPrata >= metaPrata) {
    comissoes['META PRATA (Smartphones)'] = valorSmartphones * (config.gerente_comissao_prata / 100);
  } else if (totalParaMetaPrata >= metaBronze) {
    bonus += config.gerente_bonus_bronze;
  }

  return {
    comissao: Object.values(comissoes).reduce((t, v) => t + v, 0),
    bonus,
    info: { atingiuFase3Servico: false },
    comissaoDetalhada: comissoes
  };
}

export function calcularDescontosDividas(
  dividas: Divida[],
  mesParaCalcular: string,
  dividasAplicadasNoMes?: DividaAplicadaNoMes[]
): { total: number; dividasInfo: { id: string; descricao: string; valor: number; parcelaAtual: number; parcelasTotal: number }[] } {
  return calcularDescontosDividasNoMes(dividas, mesParaCalcular, dividasAplicadasNoMes || []);
}

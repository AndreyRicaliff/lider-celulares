import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import { ColaboradorComDividas, Divida } from '@/types/database';
import {
  getDefaultConfig,
  isVendedorExcluido,
  getAjusteBonusPercentual,
  getVendorConfigOverrides,
  getFixedPayrollOverride,
  isIgnoredColumn,
  isLojaExcluidaBotons,
  getBotonOverride,
} from '@/lib/constants';
import { isLojaCampinaNatal, isLojaNatalLike } from '@/lib/lojaRules';
import {
  calcularComissaoSoledadeMonteiro,
  calcularComissaoCampinaNatal,
  calcularComissaoGerente,
  calcularDescontosDividas,
  calcularBonusMetaLojaSoledadeMonteiro,
} from '@/lib/comissaoCalculator';

const STANDARD_CATEGORY_HEADERS = [
  'VENDEDOR',
  'BONIFICADO LC',
  'SUPER BONIFICADO',
  'ANATEL',
  'CASES',
  'PELÍCULA',
  'ACESSÓRIOS',
  'GERAL',
  'PROTEÇÃO LÍDER',
  'GARANTIA ESTENDIDA',
  'ASSISTÊNCIA TÉCNICA',
  'VALOR REAL (S/ JUROS)',
];

function normalizeName(name: string): string {
  return name.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

type StagedRow = { VENDEDOR: string; [key: string]: string | number | undefined };

function mapVendaToStagedRow(venda: { vendedor_nome: string; detalhes: Record<string, unknown> }): StagedRow {
  const row: StagedRow = { VENDEDOR: venda.vendedor_nome };
  Object.entries(venda.detalhes).forEach(([key, value]) => {
    const normalizedKey = key.toUpperCase();
    if (
      key !== '_upload_source' &&
      !normalizedKey.startsWith('__') &&
      typeof value === 'number' &&
      STANDARD_CATEGORY_HEADERS.includes(normalizedKey)
    ) {
      row[normalizedKey] = value;
    }
  });
  return row;
}

async function fetchColaboradoresForLoja(lojaId: string, client: typeof supabase = supabase): Promise<ColaboradorComDividas[]> {
  const { data: colaboradores, error } = await client.from('colaboradores').select('*').order('nome');
  if (error) throw error;

  const { data: vinculos } = await client.from('colaborador_lojas').select('*');
  const vinculosByColaborador = new Map<string, any[]>();
  (vinculos || []).forEach((v: any) => {
    const arr = vinculosByColaborador.get(v.colaborador_id) || [];
    arr.push(v);
    vinculosByColaborador.set(v.colaborador_id, arr);
  });

  const filtered = (colaboradores || []).map((col: any) => {
    const vins = vinculosByColaborador.get(col.id) || [];
    const vinculoLoja = vins.find((v: any) => v.loja_id === lojaId);
    if (vinculoLoja) {
      return { ...col, cargo: vinculoLoja.cargo, salario: vinculoLoja.salario, ajuda_custo: vinculoLoja.ajuda_custo, proporcional_meta: vinculoLoja.proporcional_meta, lojas: vins };
    }
    if (col.loja_id === null) return { ...col, lojas: vins };
    return null;
  }).filter(Boolean) as any[];

  return Promise.all(
    filtered.map(async (col: any) => {
      const { data: dividas } = await client
        .from('dividas')
        .select('*')
        .eq('colaborador_id', col.id)
        .or(`loja_id.is.null,loja_id.eq.${lojaId}`);
      return {
        ...col,
        dividas: (dividas || []).map((d: any) => ({ ...d, loja_id: d.loja_id ?? null })) as Divida[],
      };
    })
  );
}

export async function calculateCommissionsForLoja(lojaId: string, mes: string, client: typeof supabase = supabase): Promise<{ count: number; error?: string }> {
  try {
    // Fetch vendas
    const { data: vendas, error: vendasError } = await client
      .from('vendas')
      .select('*')
      .eq('loja_id', lojaId)
      .eq('mes', mes);
    if (vendasError) throw vendasError;
    if (!vendas || vendas.length === 0) return { count: 0 };

    // Fetch config
    const { data: configRow } = await client
      .from('configuracoes')
      .select('config')
      .eq('loja_id', lojaId)
      .eq('mes', mes)
      .maybeSingle();

    if (!configRow?.config) return { count: 0, error: `config não encontrada para ${lojaId}/${mes}` };

    const raw = configRow.config as Record<string, unknown>;
    const configToUse: Record<string, number> = { ...getDefaultConfig(lojaId) };
    Object.entries(raw).forEach(([k, v]) => { if (typeof v === 'number') configToUse[k] = v; });

    // Fetch colaboradores with dívidas
    const colaboradores = await fetchColaboradoresForLoja(lojaId, client);
    const colaboradoresCalculaveis = colaboradores.filter(c => c.cargo !== 'Gerente');
    const gerente = colaboradores.find(c => c.cargo === 'Gerente');

    // Fetch existing commissions to preserve debt tracking
    const { data: comissoesSalvas } = await client
      .from('comissoes')
      .select('colaborador_id, detalhes')
      .eq('loja_id', lojaId)
      .eq('mes', mes);

    const dividasAplicadasPorColaborador = new Map<string, Array<{ id: string; parcelaAtual: number }>>();
    (comissoesSalvas || []).forEach((c: any) => {
      if (!c.colaborador_id) return;
      const lista = Array.isArray(c.detalhes?.dividasInfo) ? c.detalhes.dividasInfo : [];
      const normalized = lista.filter((d: any) => !!d?.id).map((d: any) => ({ id: d.id, parcelaAtual: d.parcelaAtual ?? 1 }));
      if (normalized.length > 0) dividasAplicadasPorColaborador.set(c.colaborador_id, normalized);
    });

    // Map vendas to staged rows
    const allRows: StagedRow[] = vendas.map((v: any) => mapVendaToStagedRow(v));
    const stagedDataParaCalculo = allRows.filter(row => !isVendedorExcluido(lojaId, mes, row.VENDEDOR.trim()));

    // Group by vendor
    const vendasPorVendedor: Record<string, Record<string, number>[]> = {};
    stagedDataParaCalculo.forEach(row => {
      const nome = normalizeName(row.VENDEDOR);
      if (!vendasPorVendedor[nome]) vendasPorVendedor[nome] = [];
      const detalhes: Record<string, number> = {};
      Object.entries(row).forEach(([key, value]) => {
        if (key !== 'VENDEDOR' && !isIgnoredColumn(key)) detalhes[key] = typeof value === 'number' ? value : 0;
      });
      vendasPorVendedor[nome].push(detalhes);
    });

    const comissoes: any[] = [];
    let totalGeralVendasLoja = 0;

    for (const colaborador of colaboradoresCalculaveis) {
      const nomeVendedor = normalizeName(colaborador.nome);
      if (!vendasPorVendedor[nomeVendedor]) continue;

      const totaisVendedor: Record<string, number> = {};
      let totalVendasColaborador = 0;
      vendasPorVendedor[nomeVendedor].forEach(venda => {
        Object.entries(venda).forEach(([coluna, valor]) => {
          const key = coluna.trim().toUpperCase();
          if (!isIgnoredColumn(key)) {
            totaisVendedor[key] = (totaisVendedor[key] || 0) + valor;
            totalVendasColaborador += valor;
          }
        });
      });

      const jaAplicadas = dividasAplicadasPorColaborador.get(colaborador.id);
      const { total: descontosDividas, dividasInfo } = calcularDescontosDividas(colaborador.dividas || [], mes, jaAplicadas);
      totalGeralVendasLoja += totalVendasColaborador;

      const fixedPayroll = getFixedPayrollOverride(lojaId, mes, nomeVendedor);
      if (fixedPayroll !== null) {
        comissoes.push({
          loja_id: lojaId, colaborador_id: colaborador.id, vendedor_nome: nomeVendedor, cargo: colaborador.cargo, mes,
          salario: fixedPayroll, ajuda_custo: 0, comissao_base: 0, comissao_detalhada: {}, repostagem_venda: 0,
          repostagem_comissao: 0, bonus_automatico: 0, bonus_manual: 0, descontos_dividas: descontosDividas,
          adiantamentos: 0, descontos: 0,
          detalhes: { totais: totaisVendedor, info: { folhaFixa: true }, bonusInfo: [], dividasInfo, vendedorId: colaborador.id } as unknown as Json,
        });
        continue;
      }

      const vendorOverrides = getVendorConfigOverrides(lojaId, mes, nomeVendedor);
      const configForVendor = vendorOverrides ? { ...configToUse, ...vendorOverrides } : configToUse;

      let res;
      if (lojaId === 'soledade' || lojaId === 'monteiro') {
        res = calcularComissaoSoledadeMonteiro(colaborador, totaisVendedor, configForVendor);
      } else {
        res = calcularComissaoCampinaNatal(colaborador, totaisVendedor, configForVendor, lojaId, mes);
      }

      let bonusAutomatico = 0;
      const bonusInfo: Array<{ descricao: string; valor: number }> = [];
      if (colaborador.cargo === 'VR' && (lojaId === 'soledade' || lojaId === 'monteiro')) {
        bonusAutomatico += 200;
        bonusInfo.push({ descricao: 'Bônus de Função (VR)', valor: 200 });
      }

      comissoes.push({
        loja_id: lojaId, colaborador_id: colaborador.id, vendedor_nome: nomeVendedor, cargo: colaborador.cargo, mes,
        salario: colaborador.salario, ajuda_custo: colaborador.ajuda_custo,
        comissao_base: Number.isFinite(res.comissao) ? Math.max(0, res.comissao) : 0,
        comissao_detalhada: Object.fromEntries(Object.entries(res.comissaoDetalhada || {}).map(([k, v]) => [k, Number.isFinite(v as number) ? v : 0])) as unknown as Json,
        repostagem_venda: 0, repostagem_comissao: 0,
        bonus_automatico: Number.isFinite(bonusAutomatico) ? bonusAutomatico : 0,
        bonus_manual: 0, descontos_dividas: descontosDividas, adiantamentos: 0, descontos: 0,
        detalhes: { totais: totaisVendedor, info: res.info, bonusInfo, dividasInfo, vendedorId: colaborador.id } as unknown as Json,
      });
    }

    // Best service bonus
    if (configToUse.bonus_melhor_servico > 0) {
      const elegiveisServico = comissoes.filter(c => {
        const det = c.detalhes as any;
        return det?.info?.atingiuFase3Servico && c.cargo !== 'Trainee';
      });
      if (elegiveisServico.length > 0) {
        elegiveisServico.sort((a: any, b: any) => {
          const svcA = (a.detalhes?.totais?.['PROTEÇÃO LÍDER'] || 0) + (a.detalhes?.totais?.['GARANTIA ESTENDIDA'] || 0);
          const svcB = (b.detalhes?.totais?.['PROTEÇÃO LÍDER'] || 0) + (b.detalhes?.totais?.['GARANTIA ESTENDIDA'] || 0);
          return svcB - svcA;
        });
        const vencedor = comissoes.find(c => c.vendedor_nome === elegiveisServico[0].vendedor_nome);
        if (vencedor) {
          const bonusServico = configToUse.bonus_melhor_servico;
          vencedor.bonus_automatico += bonusServico;
          (vencedor.detalhes as any).bonusInfo = [...((vencedor.detalhes as any).bonusInfo || []), { descricao: 'Melhor Vendedor Serviço', valor: bonusServico }];
        }
      }
    }

    // Best smartphone bonus
    const bonusMelhorSmartphone = (configToUse as Record<string, number>).bonus_melhor_smartphone || 0;
    if (bonusMelhorSmartphone > 0) {
      const elegiveisSmartphone = comissoes.filter((c: any) => {
        if (c.cargo === 'Trainee' || c.cargo === 'Gerente') return false;
        const totaisV = c.detalhes?.totais || {};
        const valorSm = (totaisV['BONIFICADO LC'] || 0) + (totaisV['SUPER BONIFICADO'] || 0) + (totaisV['ANATEL'] || 0);
        const col = colaboradoresCalculaveis.find(col => normalizeName(col.nome) === c.vendedor_nome);
        const proporcional = (col?.proporcional_meta || 100) / 100;
        const metaSm = configToUse.smartphones_meta * proporcional;
        const valorServicos = (totaisV['PROTEÇÃO LÍDER'] || 0) + (totaisV['GARANTIA ESTENDIDA'] || 0);
        return valorSm >= metaSm || (valorSm + valorServicos) >= metaSm;
      });
      if (elegiveisSmartphone.length > 0) {
        const qtdPorVendedor = new Map<string, number>();
        vendas.forEach((v: any) => {
          const det = (v.detalhes || {}) as Record<string, unknown>;
          const qtd = Number(det['__qtd_smartphones']) || 0;
          qtdPorVendedor.set(v.vendedor_nome.trim(), (qtdPorVendedor.get(v.vendedor_nome.trim()) || 0) + qtd);
        });
        elegiveisSmartphone.sort((a: any, b: any) => {
          const qtdA = qtdPorVendedor.get(a.vendedor_nome.trim()) || 0;
          const qtdB = qtdPorVendedor.get(b.vendedor_nome.trim()) || 0;
          if (qtdB !== qtdA) return qtdB - qtdA;
          const smA = (a.detalhes?.totais?.['BONIFICADO LC'] || 0) + (a.detalhes?.totais?.['SUPER BONIFICADO'] || 0) + (a.detalhes?.totais?.['ANATEL'] || 0);
          const smB = (b.detalhes?.totais?.['BONIFICADO LC'] || 0) + (b.detalhes?.totais?.['SUPER BONIFICADO'] || 0) + (b.detalhes?.totais?.['ANATEL'] || 0);
          return smB - smA;
        });
        const vencedorSm = comissoes.find((c: any) => c.vendedor_nome === elegiveisSmartphone[0].vendedor_nome);
        if (vencedorSm) {
          vencedorSm.bonus_automatico += bonusMelhorSmartphone;
          (vencedorSm.detalhes as any).bonusInfo = [...((vencedorSm.detalhes as any).bonusInfo || []), { descricao: 'Melhor Vendedor Smartphone', valor: bonusMelhorSmartphone }];
        }
      }
    }

    // Store meta bonus
    const totaisLoja: Record<string, number> = {};
    stagedDataParaCalculo.forEach(row => {
      Object.entries(row).forEach(([coluna, valor]) => {
        if (coluna !== 'VENDEDOR') {
          const key = coluna.trim().toUpperCase();
          totaisLoja[key] = (totaisLoja[key] || 0) + (typeof valor === 'number' ? valor : 0);
        }
      });
    });

    if (lojaId === 'soledade' || lojaId === 'monteiro') {
      const bonusMetaLoja = calcularBonusMetaLojaSoledadeMonteiro(totaisLoja, configToUse, lojaId);
      if (bonusMetaLoja > 0) {
        const tipoMeta = bonusMetaLoja === (configToUse.loja_bonus_meta_ouro || 300) ? 'Ouro' : 'Prata';
        comissoes.forEach((c: any) => {
          if (['Vendedor', 'VR', 'Trainee'].includes(c.cargo)) {
            c.bonus_automatico += bonusMetaLoja;
            (c.detalhes as any).bonusInfo = [...((c.detalhes as any).bonusInfo || []), { descricao: `Bônus Meta ${tipoMeta}`, valor: bonusMetaLoja }];
          }
        });
      }
    } else {
      const valorSmartphones = (totaisLoja['BONIFICADO LC'] || 0) + (totaisLoja['SUPER BONIFICADO'] || 0);
      const valorServicos = (totaisLoja['PROTEÇÃO LÍDER'] || 0) + (totaisLoja['GARANTIA ESTENDIDA'] || 0);
      const valorParaMetaPrata = valorSmartphones + valorServicos;
      const configRecord = configToUse as Record<string, number>;
      const metaPrata = configRecord.gerente_meta_prata || (lojaId === 'natal' ? 280000 : 190000);
      const acrescimoOuro = configRecord.gerente_meta_ouro_acrescimo || 10;
      const metaOuro = configRecord.loja_meta_ouro || (metaPrata * (1 + acrescimoOuro / 100));
      const batiuMetaPrata = valorParaMetaPrata >= metaPrata;
      const batiuMetaOuro = valorSmartphones >= metaOuro;

      if (lojaId === 'campina-grande' && batiuMetaPrata) {
        comissoes.forEach((c: any) => {
          if (c.cargo === 'VR') {
            c.bonus_automatico += 300;
            (c.detalhes as any).bonusInfo = [...((c.detalhes as any).bonusInfo || []), { descricao: 'Bônus VR Meta Prata', valor: 300 }];
          }
        });
      }
      if (batiuMetaOuro) {
        const bonusValorBase = configToUse.loja_bonus_meta_ouro || 0;
        comissoes.forEach((c: any) => {
          if (['Vendedor', 'VR', 'Trainee'].includes(c.cargo)) {
            const percentualAjuste = getAjusteBonusPercentual(lojaId, mes, c.vendedor_nome);
            const bonusValor = bonusValorBase * (percentualAjuste / 100);
            c.bonus_automatico += bonusValor;
            const desc = percentualAjuste < 100 ? `Bônus Meta Ouro (${percentualAjuste}% proporcional)` : 'Bônus Meta Ouro';
            (c.detalhes as any).bonusInfo = [...((c.detalhes as any).bonusInfo || []), { descricao: desc, valor: bonusValor }];
          }
        });
      }
    }

    // Manager commission (CG/Natal)
    if (gerente && isLojaCampinaNatal(lojaId)) {
      const fixedPayrollGerente = getFixedPayrollOverride(lojaId, mes, normalizeName(gerente.nome));
      const jaAplicadasGerente = dividasAplicadasPorColaborador.get(gerente.id);
      const { total: descontosDividasGerente, dividasInfo: dividasInfoGerente } = calcularDescontosDividas(gerente.dividas || [], mes, jaAplicadasGerente);

      if (fixedPayrollGerente !== null) {
        comissoes.push({
          loja_id: lojaId, colaborador_id: gerente.id, vendedor_nome: gerente.nome, cargo: 'Gerente', mes,
          salario: fixedPayrollGerente, ajuda_custo: 0, comissao_base: 0, comissao_detalhada: {},
          repostagem_venda: 0, repostagem_comissao: 0, bonus_automatico: 0, bonus_manual: 0,
          descontos_dividas: descontosDividasGerente, adiantamentos: 0, descontos: 0,
          detalhes: { totais: totaisLoja, info: { folhaFixa: true }, bonusInfo: [], dividasInfo: dividasInfoGerente, vendedorId: gerente.id } as unknown as Json,
        });
      } else {
        const nomeGerente = gerente.nome.trim();
        let servicosPessoaisGerente = 0;
        if (isLojaNatalLike(lojaId)) {
          const vendasPessoaisGerente = vendasPorVendedor[normalizeName(nomeGerente)]
            || Object.entries(vendasPorVendedor).find(([k]) => k.trim().toUpperCase() === nomeGerente.toUpperCase())?.[1]
            || [];
          vendasPessoaisGerente.forEach((venda: Record<string, number>) => {
            Object.entries(venda).forEach(([coluna, valor]) => {
              const key = coluna.trim().toUpperCase();
              if ((key.includes('PROTE') && key.includes('DER')) || (key.includes('GARANTIA') && key.includes('ESTENDIDA'))) {
                servicosPessoaisGerente += typeof valor === 'number' ? valor : 0;
              }
            });
          });
        }
        const resGerente = calcularComissaoGerente(totaisLoja, configToUse, lojaId);
        const comissaoServicoPessoal = servicosPessoaisGerente * 0.12;
        const comissaoDetalhadaGerente = { ...resGerente.comissaoDetalhada };
        if (comissaoServicoPessoal > 0) comissaoDetalhadaGerente['SERVIÇOS PESSOAIS (12%)'] = comissaoServicoPessoal;

        comissoes.push({
          loja_id: lojaId, colaborador_id: gerente.id, vendedor_nome: gerente.nome, cargo: 'Gerente', mes,
          salario: gerente.salario, ajuda_custo: gerente.ajuda_custo,
          comissao_base: Number.isFinite(resGerente.comissao + comissaoServicoPessoal) ? Math.max(0, resGerente.comissao + comissaoServicoPessoal) : 0,
          comissao_detalhada: Object.fromEntries(Object.entries(comissaoDetalhadaGerente || {}).map(([k, v]) => [k, Number.isFinite(v as number) ? v : 0])) as unknown as Json,
          repostagem_venda: 0, repostagem_comissao: 0,
          bonus_automatico: Number.isFinite(resGerente.bonus) ? resGerente.bonus : 0,
          bonus_manual: 0, descontos_dividas: descontosDividasGerente, adiantamentos: 0, descontos: 0,
          detalhes: { totais: totaisLoja, info: resGerente.info, bonusInfo: [{ descricao: 'Bônus Gerencial', valor: resGerente.bonus }], dividasInfo: dividasInfoGerente, vendedorId: gerente.id } as unknown as Json,
        });
      }
    }

    if (comissoes.length === 0) return { count: 0 };

    // Save commissions preserving manually-edited values
    const { data: existing } = await client
      .from('comissoes')
      .select('vendedor_nome, bonus_manual, adiantamentos, descontos')
      .eq('loja_id', lojaId)
      .eq('mes', mes);

    const manualValues = new Map<string, { bonus_manual: number; adiantamentos: number; descontos: number }>();
    (existing || []).forEach((c: any) => {
      manualValues.set(c.vendedor_nome, {
        bonus_manual: Number(c.bonus_manual || 0),
        adiantamentos: Number(c.adiantamentos || 0),
        descontos: Number(c.descontos || 0),
      });
    });

    const mergedComissoes = comissoes.map(c => {
      const prev = manualValues.get(c.vendedor_nome);
      if (prev) {
        return {
          ...c,
          bonus_manual: (c.bonus_manual || 0) + prev.bonus_manual,
          adiantamentos: (c.adiantamentos || 0) + prev.adiantamentos,
          descontos: (c.descontos || 0) + prev.descontos,
        };
      }
      return c;
    });

    await client.from('comissoes').delete().eq('loja_id', lojaId).eq('mes', mes);
    const { error: insertError } = await client.from('comissoes').insert(mergedComissoes);
    if (insertError) throw insertError;

    // Update botons
    const lojaExcluidaBotons = isLojaExcluidaBotons(lojaId, mes);
    if (!lojaExcluidaBotons) {
      for (const comissao of comissoes) {
        if (comissao.cargo === 'Gerente' || comissao.cargo === 'Trainee' || !comissao.colaborador_id) continue;
        const totais = (comissao.detalhes as any)?.totais || {};
        const col = colaboradoresCalculaveis.find(c => c.id === comissao.colaborador_id);
        const proporcional = (col?.proporcional_meta || 100) / 100;
        const configRecord = configToUse as Record<string, number>;
        const valorSm = (totais['BONIFICADO LC'] || 0) + (totais['SUPER BONIFICADO'] || 0) + (totais['ANATEL'] || 0);
        const valorSvc = (totais['PROTEÇÃO LÍDER'] || 0) + (totais['GARANTIA ESTENDIDA'] || 0);
        const metaSmartphones = valorSm >= ((configRecord.smartphones_meta || 30000) * proporcional) || (valorSm + valorSvc) >= ((configRecord.smartphones_meta || 30000) * proporcional);
        const metaServicos = valorSvc >= ((configRecord.servicos_meta_fase3 || 2500) * proporcional);
        const valorPeliculas = totais['PELÍCULA'] || 0;
        const metaPeliculas = valorPeliculas >= ((configRecord.pelicula_meta || 1500) * proporcional);

        const override = getBotonOverride(comissao.colaborador_id, mes, comissao.vendedor_nome);
        let tipo: 'triplice_coroa' | 'protecao_lider' | null = null;
        let pontos = 0;
        if (override) { tipo = override.tipo; pontos = override.pontos; }
        else if (metaServicos && metaSmartphones && metaPeliculas) { tipo = 'triplice_coroa'; pontos = 10; }
        else if (metaServicos) { tipo = 'protecao_lider'; pontos = 5; }

        await client.from('botons').delete().eq('colaborador_id', comissao.colaborador_id).eq('mes', mes);
        if (tipo) {
          await client.from('botons').insert({ colaborador_id: comissao.colaborador_id, loja_id: lojaId, mes, tipo, pontos });
        }
      }
    }

    return { count: comissoes.length };
  } catch (error: any) {
    console.error(`[batchCalc] ${lojaId}/${mes}:`, error);
    return { count: 0, error: error?.message || 'unknown error' };
  }
}

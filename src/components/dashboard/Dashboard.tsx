import { useMemo, useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/appStore';
import { useVendas } from '@/hooks/useVendas';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useComissoes } from '@/hooks/useComissoes';
import { calculateCommissionsForLoja } from '@/lib/batchCalculateCommissions';
import { useColaboradores } from '@/hooks/useColaboradores';
import { useConfiguracao, useAllConfiguracoes } from '@/hooks/useConfiguracoes';
import { useVendasDiarias } from '@/hooks/useVendasDiarias';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { LoadingOverlay } from '@/components/ui/loading';
import { formatCurrency } from '@/lib/formatters';
import { LOJAS, LOJAS_IDS, isIgnoredColumn } from '@/lib/constants';
import { useFaturamento } from '@/hooks/useFaturamento';
import { FaturamentoCards } from './FaturamentoCards';
import { MargemPanel } from './MargemPanel';
import { FaturamentoCrossLoja } from './FaturamentoCrossLoja';
import { CategoriaCards } from './CategoriaCards';
import { RankingColaboradores } from './RankingColaboradores';
import { ColaboradorTab } from './ColaboradorTab';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { isLojaCampinaNatal, isLojaSoledadeMonteiro } from '@/lib/lojaRules';
import { TrendingUp, TrendingDown, Users, DollarSign, Award, ShoppingBag, Smartphone, Shield, CalendarIcon, RefreshCw, Percent, Wallet } from 'lucide-react';
import { RankingBotons } from '@/components/ranking/RankingBotons';
import { MetaStatusCard } from './MetaStatusCard';
import { VendasDiariasChart } from './VendasDiariasChart';
import { SmartServicosChart } from './SmartServicosChart';
import { DailyStoreSalesCards } from './DailyStoreSalesCards';
import { LojaComparativoTable } from './LojaComparativoTable';
import { HistoricoLojaChart } from './HistoricoLojaChart';
import { SyncStatusBar } from './SyncStatusBar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DashboardProps {
  colaboradorLojaId?: string | null;
  variant?: 'resumo' | 'vendas';
}

export const Dashboard = ({ colaboradorLojaId, variant = 'resumo' }: DashboardProps = {}) => {
  const { selectedLoja, selectedMes, setSelectedMes, setSelectedLoja, periodoInicio, periodoFim } = useAppStore();
  const { isGerente, isAdmin } = useAuth();
  // Período agora mora no store (filtro no Header). Mantém os nomes locais para o resto do componente.
  const dataInicio = periodoInicio ?? undefined;
  const dataFim = periodoFim ?? undefined;
  // Se é colaborador, usa a loja dele; caso contrário usa a selecionada
  const effectiveLoja = colaboradorLojaId || selectedLoja;
  
  const { data: vendas, isLoading: loadingVendas } = useVendas(effectiveLoja || undefined, selectedMes);
  const { data: comissoes, isLoading: loadingComissoes } = useComissoes(effectiveLoja || undefined, selectedMes);
  const { data: colaboradores } = useColaboradores();
  const { data: config } = useConfiguracao(effectiveLoja || 'soledade', selectedMes);
  const { data: vendasDiarias = [] } = useVendasDiarias(effectiveLoja || undefined, selectedMes, { forceAllLojas: isGerente || isAdmin });
  const { data: allConfigs } = useAllConfiguracoes(selectedMes);
  const { data: faturamentos = [] } = useFaturamento(selectedMes);
  const tituloEscopo = effectiveLoja ? (LOJAS[effectiveLoja as keyof typeof LOJAS] ?? effectiveLoja) : 'Todas as Lojas';

  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();
  const autoCalcTriggered = useRef(false);

  // Auto-calculate commissions when admin loads dashboard with vendas but no commissions
  useEffect(() => {
    if (!isAdmin) return;
    if (loadingVendas || loadingComissoes) return;
    if (autoCalcTriggered.current) return;
    const hasVendas = (vendas?.length ?? 0) > 0;
    const hasComissoes = (comissoes?.length ?? 0) > 0;
    if (!hasVendas || hasComissoes) return;

    autoCalcTriggered.current = true;
    toast.info('Calculando comissões automaticamente...');
    Promise.allSettled(
      LOJAS_IDS.map(lid => calculateCommissionsForLoja(lid, selectedMes))
    ).then(results => {
      const total = results.reduce((sum, r) => sum + (r.status === 'fulfilled' ? r.value.count : 0), 0);
      if (total > 0) {
        toast.success(`${total} folhas de comissão calculadas.`);
        queryClient.invalidateQueries({ queryKey: ['comissoes'] });
      }
    });
  }, [isAdmin, loadingVendas, loadingComissoes, vendas, comissoes, selectedMes, queryClient]);

  const registeredNames = useMemo(() => {
    const names = new Set(colaboradores?.map(c => c.nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")) || []);
    return names;
  }, [colaboradores]);
  
  const filteredVendas = useMemo(() => vendas?.filter(v => {
    const normalizedName = v.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return registeredNames.has(normalizedName);
  }) || [], [vendas, registeredNames]);
  
  const filteredComissoes = useMemo(() => comissoes?.filter(c => {
    const normalizedName = c.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return registeredNames.has(normalizedName);
  }) || [], [comissoes, registeredNames]);

  const temFiltroPeriodo = !!(dataInicio || dataFim);
  const dataInicioStr = dataInicio ? format(dataInicio, 'yyyy-MM-dd') : undefined;
  const dataFimStr = dataFim ? format(dataFim, 'yyyy-MM-dd') : undefined;

  // Vendas diárias filtradas pelo período — STRICT FILTERING
  // ⚠️ CRITICAL: When a date filter is active, ALL metrics (vendas, comissoes, totals)
  // are calculated ONLY from data within the selected range.
  // When no filter is active, ALL metrics show the full month's aggregated data.
  const vendasDiariasFiltradas = useMemo(() => {
    if (!temFiltroPeriodo) return [];
    return vendasDiarias.filter(v => {
      if (dataInicioStr && v.data < dataInicioStr) return false;
      if (dataFimStr && v.data > dataFimStr) return false;
      return true;
    });
  }, [vendasDiarias, temFiltroPeriodo, dataInicioStr, dataFimStr]);

  // Métricas do período (quando filtro ativo, usa vendas_diarias; senão, usa vendas mensais)
  const { totalVendas, totalBruto, juros, totalDesconto, totaisPorCategoria, totalComissoes, totalVendedores, mediaComissao, ranking } = useMemo(() => {
    if (temFiltroPeriodo) {
      // Usar vendas diárias filtradas
      const nomesCadastrados = registeredNames;
      
      let smartphones = 0, acessorios = 0, servicos = 0, cases = 0, pelicula = 0, assistenciaTecnica = 0, geral = 0, totalGeral = 0;
      const vendedorTotals: Record<string, { nome: string; loja: string; lojaId: string; total: number; vendas: number; smartphones: number; acessorios: number; cases: number; pelicula: number; servicos: number; geral: number }> = {};
      
      vendasDiariasFiltradas.forEach(v => {
        const normalizedName = v.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const detalhes = ((v as any).detalhes || {}) as Record<string, number>;
        
        // Usar as categorias granulares do detalhes JSON para consistência com o mensal
        const smVal = (Number(detalhes['BONIFICADO LC']) || 0) + (Number(detalhes['SUPER BONIFICADO']) || 0) + (Number(detalhes['ANATEL']) || 0);
        const accVal = Number(detalhes['ACESSÓRIOS']) || 0;
        const casesVal = Number(detalhes['CASES']) || 0;
        const pelVal = Number(detalhes['PELÍCULA']) || 0;
        const svcVal = (Number(detalhes['PROTEÇÃO LÍDER']) || 0) + (Number(detalhes['GARANTIA ESTENDIDA']) || 0);
        const atVal = Number(detalhes['ASSISTÊNCIA TÉCNICA']) || 0;
        const gerVal = (Number(detalhes['GERAL']) || (Number((v as any).geral) || 0));
        
        // Usar VALOR REAL (S/ JUROS) se disponível, caso contrário usar a soma das categorias
        const vtVal = (Number(detalhes['VALOR REAL (S/ JUROS)']) || 0) || (smVal + accVal + casesVal + pelVal + svcVal + atVal + gerVal);
        
        totalGeral += vtVal;
        smartphones += smVal;
        acessorios += accVal;
        cases += casesVal;
        servicos += svcVal;
        pelicula += pelVal;
        assistenciaTecnica += atVal;
        geral += gerVal;
        
        // No ranking, incluímos o vendedor mesmo que não esteja "cadastrado" como colaborador formal
        // (Isso garante que o IGOR apareça se houver filtro de data, por exemplo)
        const key = v.vendedor_nome.trim().toUpperCase();
        if (!vendedorTotals[key]) {
          vendedorTotals[key] = { nome: key, loja: LOJAS[v.loja_id as keyof typeof LOJAS] || v.loja_id, lojaId: v.loja_id, total: 0, vendas: 0, smartphones: 0, acessorios: 0, cases: 0, pelicula: 0, servicos: 0, geral: 0 };
        }
        vendedorTotals[key].total += vtVal;
        vendedorTotals[key].vendas += 1;
        vendedorTotals[key].smartphones += smVal;
        vendedorTotals[key].acessorios += accVal;
        vendedorTotals[key].cases += casesVal;
        vendedorTotals[key].pelicula += pelVal;
        vendedorTotals[key].servicos += svcVal;
        vendedorTotals[key].geral += gerVal;
      });
      
      const registeredVendedores = new Set(vendasDiariasFiltradas.filter(v => {
        const normalizedName = v.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return nomesCadastrados.has(normalizedName);
      }).map(v => v.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
      
      // Quando filtrado por período, as comissões não podem ser filtradas por dia na DB
      // Para manter precisão, mostramos 0 ou avisamos que é mensal
      const totalComissoesVal = filteredComissoes.reduce((sum, c) => sum + Number(c.comissao_base) + Number(c.bonus_automatico) + Number(c.bonus_manual), 0); 
      
      const totalJurosFiltrado = vendasDiariasFiltradas.reduce((sum, v) => sum + (Number((v as any).juros) || 0), 0);
      const totalDescontoFiltrado = vendasDiariasFiltradas.reduce((sum, v) => sum + (Number((v as any).desconto) || 0), 0);
      return {
        totalVendas: totalGeral,
        // Bruto = líquido + juros (o que o cliente paga). Desconto é abatimento, não receita: não soma.
        totalBruto: totalGeral + totalJurosFiltrado,
        juros: totalJurosFiltrado,
        totalDesconto: totalDescontoFiltrado,
        totaisPorCategoria: { smartphones, acessorios, cases, servicos, pelicula, assistenciaTecnica, geral },
        totalComissoes: totalComissoesVal,
        totalVendedores: registeredVendedores.size,
        mediaComissao: 0,
        ranking: Object.values(vendedorTotals).sort((a, b) => b.total - a.total),
      };
    }
    
    // Sem filtro de período: usar vendas mensais (comportamento original)
    const allVendasList = vendas || [];
    const tv = allVendasList.reduce((sum, v) => {
      const detalhes = v.detalhes as Record<string, number>;
      // Preferir o VALOR REAL (S/ JUROS) se disponível no JSON de detalhes
      const valorReal = Number(detalhes['VALOR REAL (S/ JUROS)']);
      if (detalhes && !isNaN(valorReal) && valorReal > 0) {
        return sum + valorReal;
      }
      // Se não tiver VALOR REAL, somar as categorias (incluindo GERAL)
      return sum + Object.entries(detalhes || {}).reduce((s, [key, val]) => {
        const upperKey = key.toUpperCase();
        if (key !== '_upload_source' && typeof val === 'number' && !isIgnoredColumn(upperKey)) return s + val;
        return s;
      }, 0);
    }, 0);
    const tc = filteredComissoes.reduce((sum, c) => sum + Number(c.comissao_base) + Number(c.bonus_automatico) + Number(c.bonus_manual), 0);
    const tvCount = new Set(filteredVendas.map(v => v.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))).size;
    
    const catTotals = allVendasList.reduce((acc, v) => {
      const detalhes = v.detalhes as Record<string, number>;
      return {
        smartphones: acc.smartphones + (Number(detalhes?.['BONIFICADO LC']) || 0) + (Number(detalhes?.['SUPER BONIFICADO']) || 0) + (Number(detalhes?.['ANATEL']) || 0),
        acessorios: acc.acessorios + (Number(detalhes?.['ACESSÓRIOS']) || 0),
        cases: acc.cases + (Number(detalhes?.['CASES']) || 0),
        servicos: acc.servicos + (Number(detalhes?.['PROTEÇÃO LÍDER']) || 0) + (Number(detalhes?.['GARANTIA ESTENDIDA']) || 0),
        pelicula: acc.pelicula + (Number(detalhes?.['PELÍCULA']) || 0),
        assistenciaTecnica: acc.assistenciaTecnica + (Number(detalhes?.['ASSISTÊNCIA TÉCNICA']) || 0),
        geral: acc.geral + (Number(detalhes?.['GERAL']) || (Number((v as any).geral) || 0)),
      };
    }, { smartphones: 0, acessorios: 0, cases: 0, servicos: 0, pelicula: 0, assistenciaTecnica: 0, geral: 0 });
    
    const vTotals: Record<string, { nome: string; lojas: Set<string>; total: number; vendas: number; smartphones: number; acessorios: number; cases: number; pelicula: number; servicos: number; geral: number; primaryLojaId: string }> = {};
    filteredVendas.forEach(v => {
      const key = v.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const detalhes = v.detalhes as Record<string, number>;
      if (!vTotals[key]) {
        vTotals[key] = { nome: key, lojas: new Set([v.loja_id]), total: 0, vendas: 0, smartphones: 0, acessorios: 0, cases: 0, pelicula: 0, servicos: 0, geral: 0, primaryLojaId: v.loja_id };
      } else {
        vTotals[key].lojas.add(v.loja_id);
      }
      const valorRealVendedor = Number(detalhes?.['VALOR REAL (S/ JUROS)']);
      const calculatedTotal = (!isNaN(valorRealVendedor) && valorRealVendedor > 0) ? valorRealVendedor : Object.entries(detalhes || {}).reduce((s, [k, val]) => {
        const upperK = k.toUpperCase();
        if (k !== '_upload_source' && typeof val === 'number' && !isIgnoredColumn(upperK)) return s + val;
        return s;
      }, 0);
      vTotals[key].total += calculatedTotal;
      vTotals[key].vendas += 1;
      vTotals[key].smartphones += (Number(detalhes?.['BONIFICADO LC']) || 0) + (Number(detalhes?.['SUPER BONIFICADO']) || 0) + (Number(detalhes?.['ANATEL']) || 0);
      vTotals[key].acessorios += (Number(detalhes?.['ACESSÓRIOS']) || 0);
      vTotals[key].cases += (Number(detalhes?.['CASES']) || 0);
      vTotals[key].pelicula += (Number(detalhes?.['PELÍCULA']) || 0);
      vTotals[key].servicos += (Number(detalhes?.['PROTEÇÃO LÍDER']) || 0) + (Number(detalhes?.['GARANTIA ESTENDIDA']) || 0);
      vTotals[key].geral += (Number(detalhes?.['GERAL']) || (Number((v as any).geral) || 0));
    });
    
    const totalJurosMensal = allVendasList.reduce((sum, v) => sum + (Number((v as any).juros) || 0), 0);
    const totalDescontoMensal = allVendasList.reduce((sum, v) => sum + (Number((v as any).desconto) || 0), 0);
    return {
      totalVendas: tv,
      // Bruto = líquido + juros (o que o cliente paga). Desconto é abatimento, não receita: não soma.
      totalBruto: tv + totalJurosMensal,
      juros: totalJurosMensal,
      totalDesconto: totalDescontoMensal,
      totaisPorCategoria: catTotals,
      totalComissoes: tc,
      totalVendedores: tvCount,
      mediaComissao: tvCount > 0 ? tc / tvCount : 0,
      ranking: Object.values(vTotals).map(item => ({
        ...item,
        loja: item.lojas.size > 1 ? 'Multiloja' : (LOJAS[Array.from(item.lojas)[0] as keyof typeof LOJAS] || Array.from(item.lojas)[0]),
        lojaId: item.lojas.size > 1 ? 'multiloja' : item.primaryLojaId,
      })).sort((a, b) => b.total - a.total),
    };
  }, [temFiltroPeriodo, vendasDiariasFiltradas, vendas, filteredVendas, filteredComissoes, colaboradores]);

  // Metas da loja
  const isSoledadeMonteiro = isLojaSoledadeMonteiro(effectiveLoja);
  const isCampinaNatal = isLojaCampinaNatal(effectiveLoja);
  
  // Extrair config numérica do hook
  const numericConfig = config?.numericConfig || {};
  
  // Soledade/Monteiro: Meta Prata = tudo exceto GERAL, Meta Ouro = tudo exceto GERAL e Serviços
  // Campina/Natal: Meta Prata = gerente_meta_prata, Meta Ouro = prata + X%
  const metaPrata = isSoledadeMonteiro 
    ? (numericConfig?.loja_meta_prata || 55000)
    : isCampinaNatal 
      ? (numericConfig?.gerente_meta_prata || 0)
      : 0;
  const metaOuro = isSoledadeMonteiro 
    ? (numericConfig?.loja_meta_ouro || 65000)
    : isCampinaNatal 
      ? metaPrata * (1 + (numericConfig?.gerente_meta_ouro_acrescimo || 10) / 100)
      : 0;
  const bonusPrata = numericConfig?.loja_bonus_meta_prata || 200;
  const bonusOuro = numericConfig?.loja_bonus_meta_ouro || 300;
  
  // Total para comparação com metas
  // Soledade/Monteiro: Meta Prata = smartphones + serviços + acessórios + cases + película + assistência (sem GERAL)
  // Soledade/Monteiro: Meta Ouro = smartphones + acessórios + cases + película + assistência (sem serviços e sem GERAL)
  // Campina/Natal: Meta Prata = smartphones + serviços; Meta Ouro = apenas smartphones
  const totalParaMetaPrata = isSoledadeMonteiro 
    ? totaisPorCategoria.smartphones + totaisPorCategoria.servicos + totaisPorCategoria.acessorios + totaisPorCategoria.cases + totaisPorCategoria.pelicula + totaisPorCategoria.assistenciaTecnica
    : isCampinaNatal
      ? totaisPorCategoria.smartphones + totaisPorCategoria.servicos // Natal meta prata: SMART + SERVICO (sem pelicula)
      : totaisPorCategoria.smartphones + totaisPorCategoria.servicos;
  const totalParaMetaOuro = isSoledadeMonteiro
    ? totaisPorCategoria.smartphones + totaisPorCategoria.acessorios + totaisPorCategoria.cases + totaisPorCategoria.pelicula + totaisPorCategoria.assistenciaTecnica
    : totaisPorCategoria.smartphones;

  // Gastos derivados do que já existe (folha + comissões + CMV = operação; adiantamentos = fora operação).
  // Despesas fixas/avulsas e compra de seminovo exigem fonte nova (pendentes).
  const gastos = useMemo(() => {
    const folha = (comissoes || []).reduce((s, c) =>
      s + Number(c.comissao_base || 0) + Number(c.bonus_automatico || 0) + Number(c.bonus_manual || 0) + Number(c.salario || 0) + Number(c.ajuda_custo || 0), 0);
    const cmv = (vendas || []).reduce((s, v) => s + Number((v as any).custo || 0), 0);
    const adiantamentos = (comissoes || []).reduce((s, c) => s + Number(c.adiantamentos || 0), 0);
    return { operacao: folha + cmv, foraOperacao: adiantamentos };
  }, [comissoes, vendas]);

  const mesBounds = useMemo(() => {
    if (!selectedMes) return { start: undefined, end: undefined };
    const [ano, mesNum] = selectedMes.split('-').map(Number);
    const start = new Date(ano, mesNum - 1, 1);
    const end = new Date(ano, mesNum, 0);
    return { start, end };
  }, [selectedMes]);

  const temFiltroAtivo = dataInicio || dataFim;
  const periodoLabel = useMemo(() => {
    if (dataInicio && dataFim) return `${format(dataInicio, 'dd/MM')} até ${format(dataFim, 'dd/MM')}`;
    if (dataInicio) return `A partir de ${format(dataInicio, 'dd/MM')}`;
    if (dataFim) return `Até ${format(dataFim, 'dd/MM')}`;
    return '';
  }, [dataInicio, dataFim]);


  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('sync-tenfront', {
        body: {},
      });
      if (error) throw error;
      toast.success('Sincronização iniciada com sucesso! Os dados serão atualizados em alguns instantes.');
    } catch (error) {
      console.error('Erro na sincronização manual:', error);
      toast.error('Falha ao iniciar sincronização.');
    } finally {
      setIsSyncing(false);
    }
  };

  if (loadingVendas || loadingComissoes) {
    return <LoadingOverlay />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Indicador de consumo da API Tenfront — apenas admin/supervisão */}
      {isAdmin && <SyncStatusBar />}

      {colaboradorLojaId && (
        <p className="text-sm text-muted-foreground">Loja: <strong className="text-foreground">{LOJAS[colaboradorLojaId as keyof typeof LOJAS]}</strong></p>
      )}

      {variant === 'resumo' ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <FaturamentoCards faturamentos={faturamentos} configs={allConfigs ?? {}} effectiveLoja={effectiveLoja} titulo={tituloEscopo} />
            <MetricCard icon={<DollarSign className="text-success" />} label="Total Comissões" value={temFiltroAtivo ? '---' : formatCurrency(totalComissoes)} subtitle={temFiltroAtivo ? 'Disponível apenas no mensal' : (totalComissoes === 0 ? 'Execute o cálculo' : undefined)} />
            <MetricCard icon={<Users className="text-primary" />} label="Vendedores" value={String(totalVendedores)} />
            <MetricCard icon={<Award className="text-warning" />} label="Comissão Média" value={temFiltroAtivo ? '---' : formatCurrency(mediaComissao)} subtitle={temFiltroAtivo ? 'Disponível apenas no mensal' : (mediaComissao === 0 ? 'Execute o cálculo' : undefined)} />
          </div>
          {/* Gastos */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <Card className="relative overflow-hidden fx-tile">
              <div className="absolute left-0 top-0 right-0 h-[3px] bg-warning" />
              <CardContent className="p-3 sm:p-6">
                <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2"><TrendingDown size={15} className="text-warning" /> Gastos de Operação</p>
                <p className="text-xl sm:text-2xl font-bold text-warning tabular-nums truncate">{formatCurrency(gastos.operacao)}</p>
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mt-1">folha + comissões + CMV</p>
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden fx-tile">
              <div className="absolute left-0 top-0 right-0 h-[3px] bg-destructive/70" />
              <CardContent className="p-3 sm:p-6">
                <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2"><Wallet size={15} className="text-destructive/80" /> Outros Gastos <span className="text-muted-foreground/50 normal-case">(fora operação)</span></p>
                <p className="text-xl sm:text-2xl font-bold text-destructive/80 tabular-nums truncate">{formatCurrency(gastos.foraOperacao)}</p>
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mt-1">adiantamentos</p>
              </CardContent>
            </Card>
          </div>

          {/* Margem por loja + consolidado (Camada 1 — 100% da API, cravado) */}
          {faturamentos.length > 0 && (
            <MargemPanel faturamentos={faturamentos} effectiveLoja={effectiveLoja} />
          )}

          {/* 1 gráfico: faturamento por loja */}
          {faturamentos.length > 0 && (
            <FaturamentoCrossLoja faturamentos={faturamentos} configs={allConfigs ?? {}} somenteGrafico />
          )}
        </>
      ) : (
        <Tabs defaultValue="loja" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="loja">Por Loja</TabsTrigger>
            <TabsTrigger value="equipe">Equipe</TabsTrigger>
            <TabsTrigger value="colaborador">Por Colaborador</TabsTrigger>
            <TabsTrigger value="diarias">Diárias</TabsTrigger>
          </TabsList>

          <TabsContent value="loja" className="space-y-4 sm:space-y-6 mt-4">
            {effectiveLoja && isSoledadeMonteiro && (
              <MetaStatusCard totalParaPrata={totalParaMetaPrata} totalParaOuro={totalParaMetaOuro} metaPrata={metaPrata} metaOuro={metaOuro} bonusPrata={bonusPrata} bonusOuro={bonusOuro} totalFaturado={totalVendas} totalBruto={totalBruto > 0 ? totalBruto : undefined} />
            )}
            {effectiveLoja && isCampinaNatal && (
              <MetaStatusCard totalParaPrata={totalParaMetaPrata} totalParaOuro={totalParaMetaOuro} metaPrata={metaPrata} metaOuro={metaOuro} bonusPrata={0} bonusOuro={numericConfig?.loja_bonus_meta_ouro || 200} totalFaturado={totalVendas} totalBruto={totalBruto > 0 ? totalBruto : undefined} />
            )}
            <DailyStoreSalesCards vendasDiarias={vendasDiarias} selectedMes={selectedMes} allConfigs={allConfigs} />
            {!effectiveLoja && faturamentos.length > 1 && (
              <FaturamentoCrossLoja faturamentos={faturamentos} configs={allConfigs ?? {}} />
            )}
            <CategoriaCards totais={totaisPorCategoria} juros={juros} totalBruto={totalBruto} />
            <HistoricoLojaChart selectedMes={selectedMes} lojaId={effectiveLoja} />
            {!effectiveLoja && (
              <LojaComparativoTable selectedMes={selectedMes} allConfigs={allConfigs} vendasMensais={(vendas || []) as any} vendasDiarias={vendasDiarias} />
            )}
          </TabsContent>

          <TabsContent value="equipe" className="space-y-4 mt-4">
            <RankingColaboradores ranking={ranking} allConfigs={allConfigs} />
            <RankingBotons />
          </TabsContent>

          <TabsContent value="colaborador" className="mt-4">
            <ColaboradorTab ranking={ranking} />
          </TabsContent>

          <TabsContent value="diarias" className="space-y-4 mt-4">
            {effectiveLoja ? (
              <VendasDiariasChart lojaId={effectiveLoja} mes={selectedMes} dataInicio={dataInicioStr} dataFim={dataFimStr} />
            ) : (
              LOJAS_IDS.map(lojaId => <VendasDiariasChart key={lojaId} lojaId={lojaId} mes={selectedMes} dataInicio={dataInicioStr} dataFim={dataFimStr} />)
            )}
            {effectiveLoja ? (
              <SmartServicosChart lojaId={effectiveLoja} mes={selectedMes} dataInicio={dataInicioStr} dataFim={dataFimStr} />
            ) : (
              LOJAS_IDS.map(lojaId => <SmartServicosChart key={lojaId} lojaId={lojaId} mes={selectedMes} dataInicio={dataInicioStr} dataFim={dataFimStr} />)
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
}

const MetricCard = ({ icon, label, value, subtitle }: MetricCardProps) => (
  <Card className="relative overflow-hidden">
    <div className="absolute left-0 top-0 bottom-0 w-1 gradient-primary" />
    <CardContent className="p-3 sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wide mb-1 sm:mb-2 truncate">{label}</p>
          {subtitle && <p className="text-xs text-muted-foreground/70 italic mb-1">{subtitle}</p>}
          <p className="text-lg sm:text-2xl font-bold text-gradient truncate">{value}</p>
        </div>
        <div className="p-1.5 sm:p-2 bg-muted rounded-lg flex-shrink-0">{icon}</div>
      </div>
    </CardContent>
  </Card>
);
